# Creates ml\.venv and installs everything train.py needs to run on this machine's GPU.
# Safe to re-run. From the project root:
#   powershell -ExecutionPolicy Bypass -File ml\setup_env.ps1

$ml = $PSScriptRoot
$venv = Join-Path $ml '.venv'
$py = Join-Path $venv 'Scripts\python.exe'

function Assert-Step($what) {
  if ($LASTEXITCODE -ne 0) { Write-Host "FAILED: $what"; exit 1 }
}

if (-not (Test-Path $py)) {
  python -m venv $venv
  Assert-Step 'create virtual environment'
}

& $py -m pip install --upgrade pip --disable-pip-version-check
Assert-Step 'upgrade pip'

# GPU build of PyTorch (CUDA 12.8). The default PyPI wheel on Windows is CPU-only.
& $py -m pip install torch==2.8.0 torchvision==0.23.0 --index-url https://download.pytorch.org/whl/cu128
Assert-Step 'install PyTorch'

& $py -m pip install -r (Join-Path $ml 'requirements.txt')
Assert-Step 'install the Hugging Face libraries'

& $py -c "import torch; print('torch', torch.__version__, '| CUDA available:', torch.cuda.is_available(), '|', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'no GPU')"
Assert-Step 'import torch'

Write-Host 'Environment ready.'
