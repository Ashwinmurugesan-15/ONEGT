# Database Scripts - Complete Guide

This guide covers everything you need to know about setting up, managing, and understanding the database for the Assessment Portal.

---

## 📂 Directory Structure

```
scripts/
├── ddl/
│   └── ddl.sql           # 🧱 Table structure (Schema, Users, Tables)
├── seeddata/
│   └── seed_data.sql     # 🌱 Initial starter/default data
├── dml/
│   └── dml.sql           # ✍️ Real business data / Test records
├── setup-database.sh     # 🚀 Automation script (PG/YugabyteDB)
└── DATABASE_SCRIPTS.md   # 📖 This guide
```

---

## 🏗️ The Complete Setup Flow

The `setup-database.sh` script automates these steps in order:

1.  **DDL Script** = Building the structure (walls, rooms, doors)
2.  **Seed Data** = System defaults (basic keys and configurations)
3.  **DML Script** = Furnishing (adding furniture, test data, business records)

### Quick Start (Recommended)

```bash
# Standard PostgreSQL
./scripts/setup-database.sh

# YugabyteDB 
export DB_PORT=5433
export DB_SUPERUSER=yugabyte
./scripts/setup-database.sh
```

---

## 🔍 Deep Dive: Core Scripts

### 1. 🧱 DDL Script (`scripts/ddl/ddl.sql`)
**Purpose:** Defines the **STRUCTURE** of your database.
- **Creates User**: `assessment_app_user` (Principle of Least Privilege).
- **Creates Schema**: `VinavalAI_schema` (Namespace isolation).
- **Creates Tables**: `VinavalAI_users`, `assessments`, `results`, `learning_resources`.
- **Creates Indexes**: 10+ indexes for optimized searching and joining.

### 2. 🌱 Seed Data Script (`scripts/seeddata/seed_data.sql`)
**Purpose:** Inserts **MINIMAL STARTER** data to make the system functional.
- **Default Users**: Admin, Examiner, and Candidate.
- **Sample Assessment**: One basic assessment to verify the system.
- **Verification**: Automatically prints a success notice with credentials.

### 3. ✍️ DML Script (`scripts/dml/dml.sql`)
**Purpose:** Real **BUSINESS DATA** and comprehensive test records.
- **Test Users**: Large batches of examiners and candidates.
- **Full Assessments**: Detailed assessments with multiple questions.
- **Results**: Historic result data for analytics testing.
- **Learning Resources**: Educational links and metadata.

---

## 🔐 Security & Industry Best Practices

### Why This Approach?
Most beginners use the `postgres` superuser and the `public` schema. This script follows production-ready standards:

1.  **Least Privilege**: The application uses a restricted user (`assessment_app_user`) that cannot delete databases or access other apps' data.
2.  **Namespace Isolation**: All tables live in `VinavalAI_schema`, preventing conflicts with other applications sharing the same database.
3.  **Idempotency**: All scripts use `IF NOT EXISTS` or `ON CONFLICT DO NOTHING`, making them safe to run multiple times without causing errors or duplicate data.

---

## 🚀 Usage & Configuration

### Environment Variables
The setup script supports environment variables for flexible deployment:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `DB_HOST` | Database host address | `localhost` |
| `DB_PORT` | Database port | `5432` |
| `DB_SUPERUSER` | Admin user for DDL | `postgres` |

### Manual Execution (Step-by-Step)
If you prefer not to use the automation script:

```bash
# 1. Run Structure (as Admin)
sudo -u postgres psql -d assessment_engine -f scripts/ddl/ddl.sql

# 2. Run Starter Data (as App User)
PGPASSWORD='assessment_pass_2024' psql -h localhost -U assessment_app_user -d assessment_engine -f scripts/seeddata/seed_data.sql

# 3. Run Business Data (as App User)
PGPASSWORD='assessment_pass_2024' psql -h localhost -U assessment_app_user -d assessment_engine -f scripts/dml/dml.sql
```

---

## 🔍 Verification

The `seed_data.sql` script includes built-in verification. After running the setup, look for this output:

```text
========================================
Seed Data Inserted Successfully!
========================================
Admin Login    : admin@assessmentportal.com / admin123
Examiner Login : examiner@assessmentportal.com / examiner123
Candidate Login: candidate@assessmentportal.com / candidate123
========================================
```

---

## ❓ Common Questions (FAQ)

**Q: What if I run the scripts multiple times?**
A: It's perfectly safe! The scripts are designed to skip data that already exists.

**Q: How do I reset the entire database?**
A: Use these commands to wipe and restart from scratch:
```bash
dropdb assessment_engine
createdb assessment_engine
./scripts/setup-database.sh
```

**Q: Can I change the default password?**
A: Yes. Update the password in `ddl.sql`, then update the `PGPASSWORD` in the setup script and your `.env.local` file.
