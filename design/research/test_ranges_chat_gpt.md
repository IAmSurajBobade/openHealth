---
title: "Health Test Data Storage"
source: "https://chatgpt.com/c/699a9fcf-67f4-8322-a710-09ce22f93218"
author:
  - "[[ChatGPT]]"
published:
created: 2026-02-22
description: "ChatGPT is your AI chatbot for everyday use. Chat with the most advanced AI to explore ideas, solve problems, and learn faster."
tags:
  - "clippings"
---
Can you research on What are the units, ideal range basis sex, and other factors for standard tests like cbc, blood sugar, blood pressure. Is there a common pattern, that we can implement accross? And how do we store this in a relational database? What all key details we should store.

---

You’re essentially trying to design a **clinical measurement system** that works across multiple lab tests. Think of it like building a “universal grammar” for health data: every test speaks its own dialect, but there *is* a shared structure beneath it.

Let’s unpack it in layers:

---

## 🧪 1. What are the units & reference ranges?

Most clinical tests follow a common pattern:

> **Measurement = numeric value + unit + reference range + context (age, sex, condition)**

Below are key examples.

---

## 🩸 Complete Blood Count (CBC)

CBC is a *panel* (group of tests), not one value.

| Parameter | Unit | Male Range | Female Range | Notes |
| --- | --- | --- | --- | --- |
| Hemoglobin (Hb) | g/dL | 13.8–17.2 | 12.1–15.1 | ↓ anemia, ↑ dehydration |
| RBC count | million/µL | 4.7–6.1 | 4.2–5.4 |  |
| WBC count | cells/µL | 4,000–11,000 | Same | Infection marker |
| Platelets | /µL | 150k–450k | Same | Clotting |
| Hematocrit | % | 40–54 | 36–48 |  |

👉 Differences by sex exist mainly due to **hormones, body mass, blood volume**.

---

## 🍬 Blood Sugar (Glucose)

| Test | Unit | Normal | Prediabetes | Diabetes |
| --- | --- | --- | --- | --- |
| Fasting glucose | mg/dL | 70–99 | 100–125 | ≥126 |
| Postprandial | mg/dL | <140 | 140–199 | ≥200 |
| HbA1c | % | <5.7 | 5.7–6.4 | ≥6.5 |

👉 Less sex-based difference; more **condition-based (fasting vs post-meal)**.

---

## ❤️ Blood Pressure

| Category | Systolic (mmHg) | Diastolic (mmHg) |
| --- | --- | --- |
| Normal | <120 | <80 |
| Elevated | 120–129 | <80 |
| Hypertension 1 | 130–139 | 80–89 |
| Hypertension 2 | ≥140 | ≥90 |

👉 Not a single number; it's a **paired measurement (systolic/diastolic)**.

---

## 👶 Special Cases (Important)

Some ranges change dramatically with context:

| Factor | Example |
| --- | --- |
| Age | Newborn Hb higher than adult |
| Sex | Hb higher in males |
| Pregnancy | Hb lower due to dilution |
| Fasting state | Glucose changes |
| Time of day | Cortisol, BP vary |
| Altitude | Hb higher |
| Lab method | Different equipment → different ranges |

---

## 🧬 2. Is there a common pattern?

Yes — almost all medical test values follow this abstract structure:

```markdown
CodeObservation = {
    test_code,
    value,
    unit,
    reference_range,
    qualifiers (age, sex, condition),
    timestamp,
    method,
    source
}
```

Think of it as a **polymorphic measurement system**.

---

## 🧩 Core Patterns Across Tests

### 1\. Single Value Tests

- Glucose, Hemoglobin
- One numeric value

### 2\. Panel Tests

- CBC, Lipid profile
- Multiple parameters under one test

### 3\. Composite Values

- Blood pressure (two numbers)
- Ratios (LDL/HDL)

### 4\. Qualitative Tests

- Positive/Negative (e.g. infection)
- Not numeric

---

## 🎯 Universal Pattern

Every test can be normalized into:

| Field | Example |
| --- | --- |
| Test | Hemoglobin |
| Value | 13.5 |
| Unit | g/dL |
| Type | numeric / categorical |
| Context | male, adult |
| Range | 13.8–17.2 |
| Status | low / normal / high |

👉 This is the **common abstraction layer**.

---

## 🧠 3. How reference ranges actually work

Ranges are **not static**.

Instead of:

```markdown
CodeHemoglobin: 12–16
```

Real systems do:

```markdown
CodeIF sex = male AND age 18–65 → 13.8–17.2
IF female → 12.1–15.1
IF pregnant → different range
```

👉 This is **rule-based evaluation**.

---

## 🗄️ 4. Designing a relational database

Now the fun part — designing your schema.

## 🔧 Core Tables

### 1\. Test Master

Defines test types

```markdown
SQLtests (
    id,
    name,             -- Hemoglobin
    code,             -- LOINC / custom
    category,         -- CBC, glucose
    unit_default,
    value_type        -- numeric, categorical, composite
)
```

---

### 2\. Test Components (for panels)

```markdown
SQLtest_components (
    id,
    test_id,
    name,           -- RBC, WBC
    code,
    unit
)
```

👉 CBC → multiple components

---

### 3\. Reference Ranges

This is the **most critical table**

```markdown
SQLreference_ranges (
    id,
    test_component_id,
    sex,           -- male/female/any
    age_min,
    age_max,
    pregnancy_status,
    min_value,
    max_value,
    unit,
    condition,     -- fasting, non-fasting
    source,        -- WHO, lab, etc
    valid_from,
    valid_to
)
```

👉 Enables dynamic interpretation.

---

### 4\. Patients

```markdown
SQLpatients (
    id,
    sex,
    date_of_birth,
    pregnancy_status
)
```

---

### 5\. Observations (actual results)

```markdown
SQLobservations (
    id,
    patient_id,
    test_component_id,
    value,
    unit,
    observed_at,
    method,
    lab_id,
    raw_text,
    status   -- normal, high, low (optional cache)
)
```

---

### 6\. Composite Observations

For BP etc:

```markdown
SQLcomposite_observations (
    id,
    observation_id,
    key,        -- systolic, diastolic
    value
)
```

---

## 🧠 5. How evaluation works

At runtime:

1. Fetch patient context
2. Fetch applicable reference range
3. Compare value
4. Assign status

Pseudo:

```markdown
Goif value < min {
    status = "low"
} else if value > max {
    status = "high"
} else {
    status = "normal"
}
```

---

## ⚙️ 6. Standardization (VERY IMPORTANT)

To make your system scalable:

### Use standard codes:

- **LOINC** → lab test identifiers
- **SNOMED CT** → clinical concepts
- **UCUM** → units (mg/dL, mmol/L)

👉 This prevents chaos when integrating labs.

---

## 🧬 7. Advanced considerations

### 1\. Unit conversion

- mg/dL ↔ mmol/L
- Store canonical unit + conversion factor

---

### 2\. Lab-specific ranges

Different labs use different ranges.

Solution:

```markdown
Codereference_ranges.lab_id
```

---

### 3\. Versioning

Ranges change over time.

Use:

```markdown
Codevalid_from, valid_to
```

---

### 4\. Derived values

Example:

```markdown
CodeBMI = weight / height²
LDL = formula
```

Store:

```markdown
Codederived = true
formula
```

---

### 5\. Interpretation layers

Instead of only low/high:

- Normal
- Borderline
- Critical

---

## 🧩 8. A universal model (simplified)

If you want one flexible table:

```markdown
SQLmeasurements (
    id,
    patient_id,
    concept_code,
    value_numeric,
    value_text,
    unit,
    effective_time,
    context_json
)
```

👉 This is close to **FHIR Observation model**.

---

## 🚀 9. Recommended architecture

If you're building a production system:

### Option A (Best)

- Follow **FHIR Observation model**
- Use relational DB for storage

### Option B

- Hybrid: relational + JSONB for context

### Option C (simple MVP)

- normalized schema above

---

## 🧠 Final insight

Across all medical tests, the pattern is:

> **"Value without context is meaningless."**

A glucose of 110 can be:

- Normal (post-meal)
- Prediabetic (fasting)

So your system must always store:

- **Value**
- **Unit**
- **Context (age, sex, condition)**
- **Reference range source**

---

## 👍 If you're building a product

Given your previous interest in pregnancy tracking, you can extend this to:

- trimester-specific ranges
- fetal growth metrics
- maternal vitals tracking

---

If you want, I can design a **production-grade schema (Postgres + Go structs + APIs)** tailored to your MCP server or health app.

---

are there any research or open source projects already working on or researched on this topic? Can you find all such cases, compile, and give suggestions/ feedback

---

Yes — what you’re trying to build (a **standardized, context-aware clinical measurement system**) is *exactly* one of the hardest and most researched problems in healthcare IT.

The field has spent ~30 years trying to answer your question:

> “How do we store medical measurements, units, ranges, and context in a universal way?”

Let’s walk through **what already exists**, **what patterns they discovered**, and **what you should do differently (practical guidance)**.

---

## 🧭 1. Big Picture: This is called Clinical Data Standardization

The domain is known as:

- **Clinical informatics**
- **EHR (Electronic Health Records) modeling**
- **Semantic interoperability**

The core problem:

> Same test, different meaning depending on context
> (sex, age, fasting, lab, method…)

You already discovered the key complexity. The industry calls this:

> **“semantic interoperability”**

---

## 🏛️ 2. Major Standards (THE FOUNDATION)

Almost every serious system is built on these 4 pillars:

---

## 🧩 HL7 FHIR (the modern standard)

- Defines how to represent clinical data
- Uses resources like:
	- Patient
	- Observation (lab values)

👉 Most important for you

### Key idea:

Every lab value is an **Observation**

```markdown
JSON{
  "code": "hemoglobin",
  "value": 13.5,
  "unit": "g/dL",
  "referenceRange": {...},
  "subject": "patient",
  "effectiveDateTime": "..."
}
```

FHIR is:

- Modular
- API-first (REST/JSON)
- Widely adopted

👉 Designed for **exactly your use case**

---

## 🧪 LOINC (test identifiers)

Problem:

- "Hemoglobin" can be written 20 ways

Solution:

- LOINC assigns **unique codes**

Example:

- Hemoglobin → `718-7`

👉 Standard for lab tests

---

## 🧠 SNOMED CT (clinical concepts)

- Diseases
- findings
- conditions

Example:

- “Anemia” has a unique code

👉 Used for semantic meaning

---

## 🧬 UCUM (units)

- mg/dL
- mmol/L

👉 Ensures unit consistency

---

## 🧱 3. Data Modeling Approaches (Research + Systems)

There are **3 dominant approaches**.

---

## 🧠 1. FHIR Model (Event-based)

Each measurement is a record.

### Structure:

- value
- unit
- reference range
- context

👉 Good for real-time apps

---

## 🏗️ 2. openEHR (Archetype-based)

This is very close to what you're thinking.

### Idea:

Separate:

- Data structure (generic)
- Clinical logic (rules)

They use:

- **Archetypes** → define tests like CBC
- **Templates** → combine them

👉 Domain experts define clinical logic, not engineers

👉 Supports reusable models

---

## 📊 3. OMOP CDM (Research model)

Used for analytics and population studies.

- Highly normalized relational DB
- Standard vocabularies (LOINC, SNOMED)

👉 Used for large-scale research

---

## 🧪 4. Open Source Systems You Should Study

These are real-world implementations.

---

## 🏥 OpenMRS / OpenEMR

- Full EHR systems
- Store lab results

Research shows:

- OpenEMR aligns strongly with standard datasets

👉 Good reference for schema

---

## 📊 DHIS2

- Used globally (WHO, governments)

Features:

- Generic data model
- Event + aggregate data
- Supports LOINC, SNOMED

👉 Very flexible system

---

## 🔬 SMART on FHIR / HAPI FHIR

- FHIR servers
- Synthetic datasets

👉 Best starting point for APIs

---

## 🧬 OHDSI / OMOP

- Massive research ecosystem
- Standardized schema for clinical data

---

## 🧠 openEHR implementations

- Archetype-driven systems
- Clinical logic separated

---

## 🔄 FHIRconnect (research)

Solves:

- Mapping between models

Result:

- ~65% reuse across systems

---

## 🧠 MCP-FHIR frameworks (recent research)

- Combine LLM + FHIR
- Interpret clinical data

👉 Similar direction to your thinking

---

## 🧪 Spezi Data Pipeline

- Open source FHIR-based processing pipeline

👉 Handles:

- ECG, sensors, lab data

---

## 🔐 HIE of One

- Patient-controlled data exchange
- Uses OAuth + FHIR

👉 Aligns with your auth interests

---

## 🧠 5. What Research Says (Key Insights)

Across all these systems, some patterns keep repeating:

---

## 🧩 Insight 1: “Observation” is the universal unit

Everything becomes:

> **Observation (value + unit + context)**

---

## 🧩 Insight 2: Data ≠ Meaning

Raw value is useless without:

- unit
- method
- patient context

👉 Semantic layer is mandatory

---

## 🧩 Insight 3: Reference ranges are NOT static

They depend on:

- sex
- age
- pregnancy
- lab
- device

👉 Must be rule-based

---

## 🧩 Insight 4: Standard codes are critical

Without LOINC/SNOMED:

> Every system becomes incompatible

---

## 🧩 Insight 5: Dual-model architecture works best

Used by openEHR:

| Layer | Purpose |
| --- | --- |
| Reference model | generic storage |
| Clinical model | rules, ranges |

👉 This is the most powerful pattern

---

## 🧩 Insight 6: Interoperability is the hardest problem

Even today:

- Systems struggle to map data
- Heavy ETL needed

👉 Still an unsolved problem

---

💬 From practitioners:

> “Mapping FHIR, HL7… million special snowflakes”

---

## ⚠️ 6. Problems with Existing Systems

If you just copy them, you will suffer.

---

## ❌ Problem 1: Over-engineering

FHIR is complex:

- Hundreds of fields
- Hard to implement fully

---

## ❌ Problem 2: Poor handling of ranges

Most systems:

- Store ranges as static
- Not rule-driven

---

## ❌ Problem 3: Unit inconsistency

Different labs:

- mg/dL vs mmol/L

---

## ❌ Problem 4: Mapping hell

LOINC ↔ SNOMED ↔ local codes

---

## ❌ Problem 5: Poor developer experience

Many systems are:

- Hard to use
- Hard to extend

---

## 🚀 7. What YOU should build (Practical Architecture)

Here’s a modern approach combining best ideas.

---

## 🧱 Layer 1: Core Measurement Model

Keep it simple:

```markdown
SQLmeasurement (
  id,
  patient_id,
  concept_code,    -- LOINC
  value,
  unit,
  timestamp
)
```

---

## 🧠 Layer 2: Context Engine

Store context separately:

```markdown
SQLmeasurement_context (
  measurement_id,
  sex,
  age,
  pregnancy,
  fasting
)
```

---

## 📏 Layer 3: Dynamic Reference Rules

```markdown
SQLreference_rules (
  concept_code,
  condition_json,
  min,
  max
)
```

👉 Evaluate dynamically

---

## 🧩 Layer 4: Interpretation Engine

- Low / normal / high
- Critical alerts

---

## 🔄 Layer 5: Mapping Layer

- LOINC ↔ internal codes
- Unit conversion

---

## ⚡ Optional: JSONB for flexibility

```markdown
SQLextra JSONB
```

---

## 🧠 8. Key Design Recommendation (Most Important)

Don’t hardcode logic like:

```markdown
Goif hb < 13 { ... }
```

Instead:

> Build a **rules engine**

Example:

```markdown
JSON{
  "if": {
    "sex": "male",
    "age": { "gte": 18 }
  },
  "range": {
    "min": 13.8,
    "max": 17.2
  }
}
```

---

## 🔥 9. Where your idea can innovate

There is still huge opportunity:

---

## 💡 Opportunity 1: Developer-friendly FHIR

FHIR is powerful but painful.

👉 Build a simpler abstraction

---

## 💡 Opportunity 2: Dynamic reference engine

Most systems fail here.

👉 You can build:

- context-aware interpretation
- explainable results

---

## 💡 Opportunity 3: AI + interpretation

Combine:

- MCP
- FHIR
- reasoning

👉 Emerging research area

---

## 💡 Opportunity 4: India-specific models

India lacks:

- standardized ranges
- localized datasets

👉 Big gap

---

## 🧭 10. Suggested Tech Stack

Given your Go + MCP interest:

- Storage → Postgres
- API → FHIR-compatible layer
- Engine → Go rules engine
- Standards → LOINC + UCUM
- Auth → OAuth2 (you already working)

---

## 🧠 Final Insight

All systems converge to this truth:

> **“Healthcare data is not just data — it’s context + meaning.”**

You are not building a database.

You are building a **semantic system**.

---

## 👍 If you want

I can:

- Design a **production-grade schema (aligned with FHIR but simplified)**
- Provide **Go structs + validation engine**
- Show how to build **reference range rules engine**

Just tell me 👍

---

---

Let’s build this like a well-tuned instrument 🎻: simple enough to play, but capable of orchestral complexity later.

You want a **production-grade MVP schema** that:

- Works across tests (CBC, glucose, BP, thyroid, pregnancy tests)
- Supports **sex / age / pregnancy context**
- Is **extensible**
- Aligns with standards (LOINC, UCUM)
- Keeps complexity under control

We’ll design a **lean-but-powerful relational model**.

---

## 🧠 Design Philosophy (the “why” before SQL)

Think of each lab value as a **story fragment**:

> “At time T, patient X had value Y, measured in unit U, under context C, interpreted against rule R”

So we separate:

| Layer | Purpose |
| --- | --- |
| Master data | What test is this? |
| Observation | Actual measurement |
| Context | Who/when conditions |
| Reference rule | What is normal? |

👉 This avoids hardcoding logic.

---

## 🧱 1. Core Entities

We’ll define:

1. Patients
2. Concepts (tests, using LOINC style)
3. Observations
4. Observation components (for panels like CBC / BP)
5. Reference ranges (rule-based)
6. Context (pregnancy, fasting, etc.)

---

## 👤 2. Patients

Keep it minimal but extensible.

```markdown
SQLCREATE TABLE patients (
    id UUID PRIMARY KEY,
    sex VARCHAR(10) NOT NULL,  -- male, female, other
    date_of_birth DATE NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);
```

👉 Age is derived, not stored.

---

## 🤰 3. Patient State (Pregnancy, Conditions)

Pregnancy is **time-bound**, not permanent.

```markdown
SQLCREATE TABLE patient_states (
    id UUID PRIMARY KEY,
    patient_id UUID REFERENCES patients(id),
    state_type VARCHAR(50),  -- pregnancy, diabetes, hypertension
    start_date DATE,
    end_date DATE,           -- NULL = ongoing
    metadata JSONB,          -- trimester, notes
    created_at TIMESTAMP DEFAULT now()
);
```

Examples:

- pregnancy (trimester=2)
- diabetes (type=2)

👉 This lets you track:

- pregnancy
- chronic conditions
- temporary states

---

## 🧪 4. Concepts (Tests)

Align with **LOINC-like codes**

```markdown
SQLCREATE TABLE concepts (
    id UUID PRIMARY KEY,
    code VARCHAR(50) UNIQUE,     -- LOINC code
    name TEXT,                   -- Hemoglobin
    category VARCHAR(50),        -- CBC, glucose, thyroid
    value_type VARCHAR(20),      -- numeric, categorical, composite
    default_unit VARCHAR(20),    -- UCUM (g/dL, mg/dL)
    created_at TIMESTAMP DEFAULT now()
);
```

Examples:

- Hemoglobin
- Fasting glucose
- TSH
- Pregnancy test (hCG)

---

## 🧩 5. Concept Components (Panels like CBC)

CBC → Hb, RBC, WBC

```markdown
SQLCREATE TABLE concept_components (
    id UUID PRIMARY KEY,
    concept_id UUID REFERENCES concepts(id),
    code VARCHAR(50),
    name TEXT,
    unit VARCHAR(20),
    created_at TIMESTAMP DEFAULT now()
);
```

👉 For simple tests, 1 component = 1 concept

---

## 📊 6. Observations (Core Data)

Each measurement.

```markdown
SQLCREATE TABLE observations (
    id UUID PRIMARY KEY,
    patient_id UUID REFERENCES patients(id),
    concept_id UUID REFERENCES concepts(id),

    observed_at TIMESTAMP NOT NULL,

    value_numeric DOUBLE PRECISION,
    value_text TEXT,

    unit VARCHAR(20),

    source VARCHAR(50),        -- lab, device, manual
    method VARCHAR(50),        -- optional

    raw_data JSONB,            -- original report

    created_at TIMESTAMP DEFAULT now()
);
```

👉 Use:

- numeric for Hb, glucose
- text for positive/negative

---

## 🧩 7. Observation Components (CBC, BP)

For multi-value tests.

```markdown
SQLCREATE TABLE observation_components (
    id UUID PRIMARY KEY,
    observation_id UUID REFERENCES observations(id),
    component_id UUID REFERENCES concept_components(id),

    value_numeric DOUBLE PRECISION,
    value_text TEXT,
    unit VARCHAR(20)
);
```

Examples:

### CBC

- Hb = 13.2
- WBC = 9000

### Blood Pressure

- systolic = 120
- diastolic = 80

---

## 🧠 8. Observation Context

Critical for interpretation.

```markdown
SQLCREATE TABLE observation_context (
    id UUID PRIMARY KEY,
    observation_id UUID REFERENCES observations(id),

    is_fasting BOOLEAN,
    gestational_age_weeks INT,   -- pregnancy
    trimester INT,               -- 1,2,3

    notes TEXT
);
```

👉 This avoids polluting main table.

---

## 📏 9. Reference Ranges (RULE ENGINE CORE)

This is where intelligence lives.

```markdown
SQLCREATE TABLE reference_ranges (
    id UUID PRIMARY KEY,

    concept_component_id UUID REFERENCES concept_components(id),

    sex VARCHAR(10),         -- male, female, any
    age_min INT,
    age_max INT,

    is_pregnant BOOLEAN,
    trimester INT,

    fasting_required BOOLEAN,

    min_value DOUBLE PRECISION,
    max_value DOUBLE PRECISION,

    unit VARCHAR(20),

    severity VARCHAR(20),    -- normal, critical

    source VARCHAR(100),

    valid_from DATE,
    valid_to DATE,

    created_at TIMESTAMP DEFAULT now()
);
```

👉 Example:

| Test | Condition | Range |
| --- | --- | --- |
| Hb | female | 12–15 |
| Hb | pregnant (T2) | 10.5–14 |
| Glucose | fasting | 70–99 |
| TSH | pregnant | different |

---

## ⚙️ 10. Interpretation Cache (Optional but useful)

```markdown
SQLCREATE TABLE observation_interpretations (
    id UUID PRIMARY KEY,
    observation_id UUID REFERENCES observations(id),

    status VARCHAR(20),   -- low, normal, high, critical
    rule_id UUID,

    evaluated_at TIMESTAMP DEFAULT now()
);
```

👉 Cache for performance

---

## 🧬 11. Units (UCUM support)

```markdown
SQLCREATE TABLE units (
    code VARCHAR(20) PRIMARY KEY,  -- mg/dL
    name TEXT,
    system VARCHAR(20)             -- UCUM
);
```

---

## 🧠 12. Mapping to Standards (Future-proofing)

```markdown
SQLCREATE TABLE concept_mappings (
    id UUID PRIMARY KEY,
    concept_id UUID,
    system VARCHAR(50),   -- LOINC, SNOMED
    code VARCHAR(50)
);
```

---

## 🧪 13. Example Use Cases

---

## 🤰 Pregnancy Hemoglobin

1. Patient has state:
```markdown
JSON{
  "state": "pregnancy",
  "trimester": 2
}
```
1. Hb = 10.8
2. System selects:
```markdown
SQLWHERE is_pregnant = true
AND trimester = 2
```

👉 Correct range applied

---

## 🍬 Blood Sugar (50+ Female)

1. Age derived = 52
2. sex = female
3. fasting = true

Query:

```markdown
SQLWHERE sex = 'female'
AND age_min <= 52 AND age_max >= 52
AND fasting_required = true
```

---

## ❤️ Blood Pressure

Stored as:

- observation (BP)
- components:
	- systolic
	- diastolic

---

## 🧪 Thyroid (TSH)

Different ranges:

- general
- pregnancy

👉 Handled via same rule table

---

## 🧩 14. Minimal MVP vs Future

## MVP (what you should build now)

- patients
- patient\_states (pregnancy)
- concepts
- observations
- observation\_components
- reference\_ranges

👉 Enough for 90% use cases

---

## Later add:

- SNOMED mappings
- audit logs
- device integration
- FHIR API layer

---

## 🚀 15. Key Decisions You Got Right

Your thinking aligns with real systems:

✔ context-aware ranges
✔ unified model
✔ pregnancy-specific logic
✔ extensibility

👉 You’re basically building a **mini clinical engine**

---

## 🧠 Final Insight

If you remember one thing:

> **Do not bake rules into code. Store them as data.**

Because medicine changes.

Your database should adapt like a living organism, not a fossil.

---

## 👍 If you want next step

I can help you build:

- Go structs (ORM-ready)
- Range evaluation engine (with rules)
- Example dataset (CBC, glucose, pregnancy)
- FHIR-compatible API layer

Just say the word 🚀