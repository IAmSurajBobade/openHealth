# PDF from JSON

Utility to generate PDF from JSON data.

## Usage

```bash
# Create virtual environment
python3 -m venv .venv

# Activate virtual environment
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Generate PDF
python3 scripts/pdf_from_json/generate_report.py --config scripts/pdf_from_json/config.json
```