#!/usr/bin/env python3
"""Generate PDF reports with vertically grouped A4 tables and extract config/data JSONs.

Usage:
  source .venv/bin/activate
  python3 scripts/pdf_from_json/generate_report.py --config scripts/pdf_from_json/config.json
"""
from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from dateutil import parser as dateparser
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
import io
import tempfile
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import os

def safe_id(name: str) -> str:
    name = re.sub(r"[^a-zA-Z0-9\s]", "", name)
    return re.sub(r"\s+", "_", name).strip("_").lower()

def parse_date(s: str) -> datetime:
    try:
        return dateparser.parse(s)
    except Exception:
        return datetime.strptime(s, "%Y/%m/%d")

def load_data(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)

def is_numeric(v: Any) -> bool:
    try:
        if v is None or v == "": return False
        float(v)
        return True
    except Exception: return False

def parse_range(ref_str: str) -> Tuple[Optional[float], Optional[float]]:
    """Extracts numeric min and max bounds from common ref range string patterns."""
    if not ref_str: return None, None
    ref_str = ref_str.replace(",", "").strip()

    # e.g "150000-450000" or "0.27 - 4.2"
    m = re.search(r"([\d\.]+)\s*-\s*([\d\.]+)", ref_str)
    if m:
        return float(m.group(1)), float(m.group(2))

    # e.g "< 150"
    m = re.search(r"<\s*([\d\.]+)", ref_str)
    if m: return None, float(m.group(1))

    # e.g "> 40"
    m = re.search(r">\s*([\d\.]+)", ref_str)
    if m: return float(m.group(1)), None

    return None, None

def render_chart(points: List[Dict[str, Any]], chart_type: str, fallback_color: str) -> io.BytesIO:
    dates = [p["dt"] for p in points]
    values = [float(p["value"]) for p in points]

    # Extremely tight figure to eliminate whitespace
    fig, ax = plt.subplots(figsize=(4.5, 1.1), dpi=150)
    fig.subplots_adjust(left=0.08, right=0.98, top=0.95, bottom=0.25)

    # Extract structural ideal range from the latest point
    r_min, r_max = parse_range(points[-1].get("ref_range", ""))

    # 1. Plot Faint Range Band in Background
    if r_min is not None and r_max is not None:
        ax.axhspan(r_min, r_max, color="#c2f0c2", alpha=0.4, lw=0, zorder=0) # Faint green
    elif r_max is not None:
        ax.axhspan(min(values + [0]) if min(values + [0]) >= 0 else min(values), r_max, color="#c2f0c2", alpha=0.4, lw=0, zorder=0)
    elif r_min is not None:
        ax.axhspan(r_min, max(values) * 1.1, color="#c2f0c2", alpha=0.4, lw=0, zorder=0)

    # 2. Determine Conditional Colors (Dark Green / Dark Red)
    colors = []
    for v in values:
        if r_min is not None and r_max is not None:
             colors.append("#1a7a1a" if r_min <= v <= r_max else "#d92626") # Dark green or red
        elif r_max is not None:
             colors.append("#1a7a1a" if v <= r_max else "#d92626")
        elif r_min is not None:
             colors.append("#1a7a1a" if v >= r_min else "#d92626")
        else:
             colors.append(fallback_color)

    # 3. Plot Data
    if chart_type == "bar":
        # For dates, bar width needs to be managed if dates are close
        ax.bar(dates, values, color=colors, alpha=0.8, width=0.8, zorder=2)
    else:
        # Faint connecting line
        ax.plot(dates, values, color="#888888", linewidth=1.5, alpha=0.4, zorder=1)
        ax.scatter(dates, values, c=colors, s=30, zorder=3)

    ax.xaxis.set_major_locator(mdates.AutoDateLocator(maxticks=5))
    ax.xaxis.set_major_formatter(mdates.ConciseDateFormatter(mdates.AutoDateLocator()))

    # 4. Clean up axes for brevity
    ax.tick_params(axis='both', which='major', labelsize=6, colors='#555555', pad=2)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color('#e0e0e0')
    ax.spines['bottom'].set_color('#e0e0e0')
    ax.grid(axis='y', alpha=0.3, linestyle="--", zorder=0)

    buf = io.BytesIO()
    # bbox_inches='tight' and pad_inches=0 completely shave off surrounding whitespace
    fig.savefig(buf, format="png", dpi=150, bbox_inches='tight', pad_inches=0.02)
    plt.close(fig)
    buf.seek(0)
    return buf

def filter_and_sort_readings(
    tests_data: Dict[str, List[Dict[str, Any]]],
    config: Dict[str, Any]
) -> Dict[str, List[Dict[str, Any]]]:
    """Filters, limits, and sorts the clustered readings based on config."""
    result = {}

    # Extract config
    includes = config.get("include_tests", ["*"])
    excludes = set(config.get("exclude_tests", []))
    sort_strategy = config.get("sort", "by_date_des")
    max_count = config.get("max_readings_per_test", 0)

    date_range = config.get("date_range", {})
    r_start_str = date_range.get("start", "")
    r_end_str = date_range.get("end", "")

    dt_start = parse_date(r_start_str) if r_start_str else None
    dt_end = parse_date(r_end_str) if r_end_str else None

    include_all = "*" in includes
    include_set = set(includes)

    for t_name, readings in tests_data.items():
        if t_name in excludes: continue
        if not include_all and t_name not in include_set: continue

        filtered_readings = []
        for r in readings:
            dt = r["dt"]
            if dt_start and dt < dt_start: continue
            if dt_end and dt > dt_end: continue
            filtered_readings.append(r)

        if not filtered_readings:
            continue

        # Sort internally based on strategy
        if sort_strategy == "by_date_des":
             filtered_readings.sort(key=lambda x: x["dt"], reverse=True)
        elif sort_strategy == "by_date_asc":
             filtered_readings.sort(key=lambda x: x["dt"], reverse=False)
        elif sort_strategy == "by_name_asc":
             filtered_readings.sort(key=lambda x: str(x["value"]).lower(), reverse=False)
        elif sort_strategy == "by_name_des":
             filtered_readings.sort(key=lambda x: str(x["value"]).lower(), reverse=True)

        # Slice
        if max_count > 0:
             filtered_readings = filtered_readings[:max_count]

        result[t_name] = filtered_readings

    return result

def determine_test_order(tests_available: List[str], config: Dict[str, Any]) -> List[str]:
    seq = config.get("test_sequence", [])
    ordered = []

    # 1. Add requested ones in order if they exist
    for t in seq:
        if t in tests_available:
            ordered.append(t)

    # 2. Add remaining unlisted tests alphabetically
    unlisted = sorted([t for t in tests_available if t not in ordered], key=lambda x: x.lower())
    ordered.extend(unlisted)
    return ordered

def build_pdf(
    grouped_tests: Dict[str, List[Dict[str, Any]]],
    ordered_names: List[str],
    out_path: Path,
    patient_meta: Dict[str, Any],
    config: Dict[str, Any]
):
    date_format = config.get("date_format", "%d %b %Y")
    diagram_config = config.get("diagram", {})

    margins = 14 * mm
    doc = SimpleDocTemplate(str(out_path), pagesize=A4, rightMargin=margins, leftMargin=margins, topMargin=margins, bottomMargin=margins)
    styles = getSampleStyleSheet()
    story = []

    # --- Attractive Patient Header Table ---
    hdr_style_label = ParagraphStyle("HdrLabel", parent=styles["Normal"], fontSize=8, textColor=colors.darkgray)
    hdr_style_val = ParagraphStyle("HdrVal", parent=styles["Normal"], fontSize=10, textColor=colors.black, fontName="Helvetica-Bold")

    # Top-level Document Header
    title_style = ParagraphStyle("Title", parent=styles["Heading1"], fontSize=16, textColor=colors.HexColor("#2c3e50"))
    r_align_style = ParagraphStyle("RightAlign", parent=styles["Normal"], alignment=2, fontSize=9, textColor=colors.darkgray)

    top_table = Table([
        [Paragraph("Patient Diagnostic Report", title_style), Paragraph(f"Generated: {datetime.now().strftime(date_format + ' %H:%M')}", r_align_style)]
    ], colWidths=[100*mm, 82*mm])
    top_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'BOTTOM'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(top_table)

    p_name = patient_meta.get('name', 'Unknown')
    p_gender = patient_meta.get('gender', 'Unknown')

    raw_dob = patient_meta.get('dob')
    p_dob = "Unknown"
    if raw_dob:
        try: p_dob = parse_date(raw_dob).strftime(date_format)
        except Exception: p_dob = raw_dob

    cond_strs = []
    for c in patient_meta.get("conditions", []):
        c_name = c.get("name", "")
        if c_name.lower() == "pregnancy" and "last_menstrual_period" in c:
            try:
                lmp = parse_date(c["last_menstrual_period"])
                now = datetime.now()
                days_pregnant = (now - lmp).days
                weeks = days_pregnant // 7
                days = days_pregnant % 7
                edd = lmp + timedelta(days=280)
                cond_strs.append(f"Pregnancy ({weeks}W {days}D | EDD: {edd.strftime(date_format)})")
            except Exception:
                cond_strs.append(c_name)
        else:
            d_date = c.get("diagnosed_date")
            d_str = ""
            if d_date:
                 try:
                     parsed_d = parse_date(d_date)
                     d_str = f" (Diagnosed: {parsed_d.strftime(date_format)})"
                 except Exception: pass
            cond_strs.append(f"{c_name}{d_str}")

    conditions_txt = ", ".join(cond_strs) if cond_strs else "None Reported"

    header_data = [
        [Paragraph("PATIENT NAME", hdr_style_label), Paragraph("DOB", hdr_style_label), Paragraph("GENDER", hdr_style_label)],
        [Paragraph(p_name, hdr_style_val), Paragraph(p_dob, hdr_style_val), Paragraph(p_gender, hdr_style_val)],
        [Paragraph("CONDITIONS", hdr_style_label), "", ""],
        [Paragraph(conditions_txt, hdr_style_val), "", ""]
    ]

    header_table = Table(header_data, colWidths=[65*mm, 60*mm, 57*mm])
    header_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f4f6f9")),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#dcdfe6")),
        ('LINEBELOW', (0,0), (-1,0), 0.5, colors.HexColor("#dcdfe6")),
        ('LINEBELOW', (0,1), (-1,1), 0.5, colors.HexColor("#dcdfe6")),
        ('SPAN', (0,2), (2,2)),
        ('SPAN', (0,3), (2,3)),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 10))

    cell_style = ParagraphStyle("Cell", parent=styles["Normal"], fontSize=9, leading=10)

    # Construct the data table and record span commands
    table_data = [["Test Name", "Date", "Reading", "Ref Range", "Context"]]
    style_cmds = [
        ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
        ("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),    # Everything centered by default
        ("ALIGN", (0, 1), (0, -1), "LEFT"),       # Test name left-aligned
    ]

    current_row = 1
    for t_name in ordered_names:
        readings = grouped_tests[t_name]
        num_readings = len(readings)
        if num_readings == 0: continue

        start_row_for_test = current_row

        # To handle Context and Ref Range spanning, track chunks of identical values
        # Chunk structure: (start_row, end_row)
        ref_chunks: List[Tuple[int, int, str]] = []
        ctx_chunks: List[Tuple[int, int, str]] = []

        curr_ref_start = current_row
        curr_ref_val = readings[0]["ref_range"]

        curr_ctx_start = current_row
        curr_ctx_val = readings[0]["context"]

        for i, r in enumerate(readings):
             # End chunk if changes or if last item
             if r["ref_range"] != curr_ref_val:
                 ref_chunks.append((curr_ref_start, current_row - 1, curr_ref_val))
                 curr_ref_start = current_row
                 curr_ref_val = r["ref_range"]

             if r["context"] != curr_ctx_val:
                 ctx_chunks.append((curr_ctx_start, current_row - 1, curr_ctx_val))
                 curr_ctx_start = current_row
                 curr_ctx_val = r["context"]

             # Append data row. If it's a spanned cell, subsequent rows just have empty strings there,
             # though ReportLab ignores the content due to SPAN.
             name_cell = Paragraph(t_name, cell_style) if i == 0 else ""
             ref_cell = Paragraph(str(r["ref_range"]), cell_style) if current_row == curr_ref_start else ""
             ctx_cell = Paragraph(str(r["context"]), cell_style) if current_row == curr_ctx_start else ""

             reading_display = f"{r['value']} {r['unit']}".strip()

             table_data.append([
                 name_cell,
                 r["dt"].strftime(date_format),
                 reading_display,
                 ref_cell,
                 ctx_cell
             ])
             current_row += 1

        # Flush final chunks
        ref_chunks.append((curr_ref_start, current_row - 1, curr_ref_val))
        ctx_chunks.append((curr_ctx_start, current_row - 1, curr_ctx_val))

        # Add SPAN commands
        # 1. Span Test Name
        if num_readings > 1:
            style_cmds.append(("SPAN", (0, start_row_for_test), (0, current_row - 1)))
            style_cmds.append(("VALIGN", (0, start_row_for_test), (0, current_row - 1), "TOP"))

        # 2. Span Ref Ranges
        for (sr, er, val) in ref_chunks:
             if er > sr:
                 style_cmds.append(("SPAN", (3, sr), (3, er)))

        # 3. Span Contexts
        for (sr, er, val) in ctx_chunks:
             if er > sr:
                 style_cmds.append(("SPAN", (4, sr), (4, er)))

        # Alternating background for whole test blocks for readability
        bg_idx = (ordered_names.index(t_name)) % 2
        bg_color = colors.lawngreen if bg_idx == 0 else colors.lightcyan
        # Give a very subtle tint (using whiteish versions)
        tint = colors.Color(0.97, 0.97, 0.99) if bg_idx == 0 else colors.white
        style_cmds.append(("BACKGROUND", (0, start_row_for_test), (-1, current_row - 1), tint))


    if len(table_data) > 1: # We have data beyond header
        # Calculate A4 Portrait Widths (210mm max - 28mm margin = 182mm usable)
        # Test Name (60), Date (28), Reading (34), Ref(30), Context(30)
        colWidths = [60*mm, 28*mm, 34*mm, 30*mm, 30*mm]
        tbl = Table(table_data, colWidths=colWidths, repeatRows=1)
        tbl.setStyle(TableStyle(style_cmds))
        story.append(tbl)
    else:
        story.append(Paragraph("No data matched the configuration criteria.", styles["Normal"]))

    tmp_files = []
    if diagram_config.get("create", False):
        min_readings = diagram_config.get("min_readings_for_diagram", 2)
        diagram_tests = {t["name"]: t for t in diagram_config.get("tests", [])}

        diag_includes = diagram_config.get("include_tests", ["*"])
        diag_excludes = set(diagram_config.get("exclude_tests", []))
        include_all_diag = "*" in diag_includes
        diag_include_set = set(diag_includes)

        default_type = diagram_config.get("default_type", "line")
        default_color = diagram_config.get("default_color", "blue")

        story.append(Spacer(1, 10))
        heading_style = ParagraphStyle("Heading2", parent=styles["Heading2"], fontSize=10, textColor=colors.darkgray)

        # We can pack diagrams side-by-side using an invisible table for maximum compactness
        diagram_cells = []

        for t_name in ordered_names:
            if t_name in diag_excludes: continue
            if not include_all_diag and t_name not in diag_include_set: continue

            readings = grouped_tests[t_name]
            numeric_readings = [r for r in readings if is_numeric(r["value"])]
            numeric_readings.sort(key=lambda x: x["dt"])
            if len(numeric_readings) >= min_readings:
                cfg = diagram_tests.get(t_name, {})
                c_type = cfg.get("type", default_type)
                c_color = cfg.get("color", default_color)

                imgbuf = render_chart(numeric_readings, c_type, c_color)
                tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
                try:
                    tmp.write(imgbuf.getbuffer())
                finally:
                    tmp.close()
                tmp_files.append(tmp.name)

                img = Image(tmp.name, width=85 * mm, height=22 * mm) # Smaller size!

                # Bundle the title and image into a sub-table
                cell_table = Table([
                    [Paragraph(f"<b>{t_name}</b> Trend", heading_style)],
                    [img]
                ], colWidths=[85*mm])
                cell_table.setStyle(TableStyle([
                    ('ALIGN', (0,0), (-1,-1), 'LEFT'),
                    ('LEFTPADDING', (0,0), (-1,-1), 0),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 0),
                ]))

                diagram_cells.append(cell_table)

        # Batch into rows of 2 for grid layout
        if diagram_cells:
            grid_data = []
            for i in range(0, len(diagram_cells), 2):
                row = [diagram_cells[i]]
                if i + 1 < len(diagram_cells):
                    row.append(diagram_cells[i+1])
                else:
                    row.append("") # empty cell for odd counts
                grid_data.append(row)

            grid_table = Table(grid_data, colWidths=[90*mm, 90*mm])
            grid_table.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 5),
                ('BOTTOMPADDING', (0,0), (-1,-1), 8),
            ]))
            story.append(grid_table)

    doc.build(story)

    for fn in tmp_files:
        try: os.unlink(fn)
        except Exception: pass

def process_file(file_path: Path, config: Dict[str, Any], output_dir: Path, global_meta: Dict[str, Any]):
    data = load_data(file_path)

    # 1. Collect all raw readings into test groups
    raw_aggregated: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

    def proc_node(name: str, date_str: str, rec: Dict, result: Any, unit: str, ref_range: str):
         if not name or result is None or str(result) == "": return

         raw_aggregated[name].append({
              "dt": parse_date(date_str),
              "date_str": date_str,
              "value": result,
              "unit": unit,
              "ref_range": ref_range,
              "context": rec.get("context", "")
         })

         # Global Meta Extraction
         tid = safe_id(name)
         if tid not in global_meta["tests"]:
             global_meta["tests"][tid] = {"id": tid, "name": name, "unit": unit, "range": ref_range}
         else:
             if unit: global_meta["tests"][tid]["unit"] = unit
             if ref_range: global_meta["tests"][tid]["range"] = ref_range

         meta_node = rec.get("meta", {})
         doc_name = meta_node.get("ref_doc")
         facility_name = meta_node.get("facility")
         context = rec.get("context")

         if doc_name:
             did = safe_id(doc_name)
             if did not in global_meta["doctors"]:
                  global_meta["doctors"][did] = {"id": did, "display_name": doc_name, "contexts": set(), "visit_dates": set()}
             if context: global_meta["doctors"][did]["contexts"].add(context)
             global_meta["doctors"][did]["visit_dates"].add(date_str)

         if facility_name:
             fid = safe_id(facility_name)
             if fid not in global_meta["facilities"]:
                  global_meta["facilities"][fid] = {"id": fid, "name": facility_name, "contexts": set(), "visit_dates": set()}
             if context: global_meta["facilities"][fid]["contexts"].add(context)
             global_meta["facilities"][fid]["visit_dates"].add(date_str)


    for rec in data.get("reading", []):
        date_raw = rec.get("date")
        if not date_raw: continue

        if "result" in rec:
            proc_node(rec.get("name"), date_raw, rec, rec.get("result"), rec.get("unit", ""), rec.get("ref_range", ""))

        if "tests" in rec and isinstance(rec["tests"], list):
            for t in rec["tests"]:
                if "tests" in t and isinstance(t["tests"], list):
                     for tt in t["tests"]:
                          proc_node(tt.get("name"), date_raw, rec, tt.get("result"), tt.get("unit", ""), tt.get("ref_range", ""))
                else:
                     proc_node(t.get("name"), date_raw, rec, t.get("result"), t.get("unit", ""), t.get("ref_range", ""))

    # 2. Filter, Sort, Limit
    filtered_groups = filter_and_sort_readings(raw_aggregated, config)

    # 3. Sequencing
    ordered_names = determine_test_order(list(filtered_groups.keys()), config)

    # 4. Global Meta unrolled tests tracking
    for t_n in ordered_names:
        global_meta["used_tests"].add(t_n)

    # 5. Build PDF
    patient_name = data.get("name", "UnknownPatient")
    timestamp = datetime.now()
    naming_pattern = config.get("naming_pattern", "report_{PATIENT_NAME}_{YYMMDD}_{HHMMSS}.pdf")
    patient_first_name = patient_name.split()[0] if patient_name and patient_name.split() else "UnknownPatient"
    file_name = naming_pattern.replace("{PATIENT_NAME}", patient_first_name) \
                              .replace("{YYMMDD}", timestamp.strftime("%y%m%d")) \
                              .replace("{HHMMSS}", timestamp.strftime("%H%M%S"))
    out_file = output_dir / file_name

    patient_meta = {"name": patient_name, "dob": data.get("dob"), "gender": data.get("gender"), "conditions": data.get("conditions", [])}
    build_pdf(filtered_groups, ordered_names, out_file, patient_meta, config)
    print(f"Generated V4 Layout PDF: {out_file}")

def main():
    parser = argparse.ArgumentParser(description="Generate V4 PDF and extract JSON data")
    parser.add_argument("--config", required=True, help="Path to config.json")
    args = parser.parse_args()

    config_path = Path(args.config).resolve()
    if not config_path.exists():
        print(f"Config file not found: {config_path}")
        return

    with config_path.open("r", encoding="utf-8") as f:
        config = json.load(f)

    repo_root = Path.cwd()
    input_val = config.get("input_path")
    if not input_val: return

    input_path = repo_root / input_val
    output_dir = repo_root / config.get("output_dir", "data/out_v4")
    output_dir.mkdir(parents=True, exist_ok=True)

    # Global extractors
    global_meta = {
        "tests": {},
        "doctors": {},
        "facilities": {},
        "used_tests": set() # track which tests actually made it to PDF across all files
    }

    if input_path.is_file() and input_path.suffix == ".json":
        process_file(input_path, config, output_dir, global_meta)
    elif input_path.is_dir():
        for f in input_path.glob("*.json"):
            process_file(f, config, output_dir, global_meta)

    # --- Write data.json ---
    final_output = {
         "tests": list(global_meta["tests"].values()),
         "doctors": [],
         "facilities": []
    }

    for d_id, d_data in global_meta["doctors"].items():
        d_data["contexts"] = sorted(list(d_data["contexts"]))
        d_data["visit_dates"] = sorted(list(d_data["visit_dates"]))
        final_output["doctors"].append(d_data)

    for f_id, f_data in global_meta["facilities"].items():
        f_data["contexts"] = sorted(list(f_data["contexts"]))
        f_data["visit_dates"] = sorted(list(f_data["visit_dates"]))
        final_output["facilities"].append(f_data)

    data_json_path = output_dir / "data.json"
    with data_json_path.open("w", encoding="utf-8") as f:
         json.dump(final_output, f, indent=4)
    print(f"Generated extraction: {data_json_path}")

    # --- Write report_YYMMDDHHMM.json (Unrolled Config) ---
    unrolled_config = config.copy()
    unrolled_config["include_tests"] = sorted(list(global_meta["used_tests"]))

    timestamp_str = datetime.now().strftime("%y%m%d%H%M")
    report_cfg_path = output_dir / f"report_{timestamp_str}.json"

    with report_cfg_path.open("w", encoding="utf-8") as f:
         json.dump(unrolled_config, f, indent=4)
    print(f"Generated Unrolled Config: {report_cfg_path}")

if __name__ == "__main__":
    main()
