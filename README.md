# Real-Time Stocks: Pipeline Evolution (V1 to V2)

This repository documents the evolution of a real-time financial tracking system, moving from a heavyweight enterprise data stack to a hyper-efficient serverless architecture.

---

## 🚀 Version 2: Modern Serverless Dashboard (Current)
**Live Demo:** [https://d0fc8457.marketpulse-91t.pages.dev](https://d0fc8457.marketpulse-91t.pages.dev)

The current version of the project leverages **Cloudflare's Edge Network** to provide a global, zero-latency financial dashboard. By moving logic to the edge, we eliminated the need for complex orchestration and reduced operational costs to nearly zero.

### Tech Stack (V2)
- **Frontend:** React + Vite (Glassmorphism UI)
- **Worker API:** Cloudflare Workers (V8 Isolates)
- **Database:** Cloudflare D1 (Edge SQLite)
- **Storage:** Cloudflare R2 (Object Storage)
- **Deployment:** Cloudflare Pages

### Key Innovation: On-Demand Caching
To prevent API exhaustion, V2 utilizes a smart "Pull-on-Demand" strategy. Data is only fetched from the 3rd-party provider if the edge cache is older than 60 seconds, allowing the system to scale to thousands of concurrent users while making only 1 API call per minute per symbol.

---

## 🏗️ Version 1: Heavy Modern Data Stack (Legacy)
Originally, the project was built as an enterprise-grade streaming pipeline. While robust, it required significant local resources and always-on infrastructure.

![Architecture (1)](https://github.com/user-attachments/assets/6b49eb4d-4bf7-473d-9281-50c20b241760)

### Tech Stack (V1)
- **Snowflake** → Cloud Data Warehouse  
- **DBT** → SQL-based Transformations  
- **Apache Airflow** → Workflow Orchestration  
- **Apache Kafka** → Real-time Streaming  
- **MinIO** → Object Storage (S3-compatible)
- **Docker** → Containerization  
- **Power BI** → Data Visualization  

### V1 Performance Characteristics
- **Orchestration:** Relied on Airflow DAGs triggering every minute.
- **Streaming:** Multi-node Kafka cluster for topic management.
- **Transformation:** Heavy DBT models running inside Snowflake layers (Bronze -> Silver -> Gold).

---

## 📂 Repository Structure
```text
real-time-stocks-mds/
├── api/                          # [V2] Cloudflare Worker Backend
├── frontend/                     # [V2] React Dashboard Frontend
├── report.tex                    # Technical LaTeX Report
├── report.pdf                    # Generated PDF Report
└── legacy_v1/                    # [V1] Legacy Pipeline Scripts
```

---

## 👤 Author
**Samarth Agarwal**
- **Email:** [samarthagrawal526@gmail.com](mailto:samarthagrawal526@gmail.com)
- **GitHub:** [github.com/samarth70](https://github.com/samarth70)

---
*Note: This project serves as a case study in migrating from monolithic enterprise data stacks to serverless edge computing.*
