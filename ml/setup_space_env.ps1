# Creates ml\.venv-space with everything ml\space\app.py needs to run on this machine.
# It is separate from ml\.venv, so the training environment is never changed.
# Safe to re-run. From the project root:
#   powershell -ExecutionPolicy Bypass -File ml\setup_space_env.ps1
#
# Gradio needs Python 3.10 or newer and this machine has 3.9, so uv (a Python installer)
# fetches its own Python 3.12 for this environment. Both uv and that Python are kept in
# ml\.uv, so nothing outside this folder is changed and deleting it undoes everything.

$ml = $PSScriptRoot
$space = Join-Path $ml 'space'
$tools = Join-Path $ml '.uv'
$uv = Join-Path $tools 'Scripts\uv.exe'
$venv = Join-Path $ml '.venv-space'
$py = Join-Path $venv 'Scripts\python.exe'
$env:UV_PYTHON_INSTALL_DIR = Join-Path $tools 'python'

function Assert-Step($what) {
  if ($LASTEXITCODE -ne 0) { Write-Host "FAILED: $what"; exit 1 }
}

if (-not (Test-Path $uv)) {
  python -m venv $tools
  Assert-Step 'create the uv tool environment'
  & (Join-Path $tools 'Scripts\python.exe') -m pip install uv --disable-pip-version-check
  Assert-Step 'install uv'
}

if (-not (Test-Path $py)) {
  & $uv venv --python 3.12 $venv
  Assert-Step 'create the Space environment'
}

# The Gradio version is whatever the Space itself declares, so local runs match Hugging Face.
$gradio = (Select-String -Path (Join-Path $space 'README.md') -Pattern '^sdk_version:\s*(\S+)').Matches[0].Groups[1].Value

& $uv pip install --python $py "gradio==$gradio" -r (Join-Path $space 'requirements.txt')
Assert-Step 'install Gradio and the model libraries'

& $py -c "import gradio, torch, transformers; print('gradio', gradio.__version__, '| transformers', transformers.__version__, '| torch', torch.__version__)"
Assert-Step 'import the libraries'

Write-Host 'Space environment ready.'
