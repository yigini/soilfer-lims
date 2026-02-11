# Glossary

A reference for technical terms used in this guide.

---

| Term | Definition |
|------|-----------|
| **API** | Application Programming Interface — a way for software programs to communicate with each other. When your browser loads data from SoilFER-LIMS, it's using the API. |
| **Certbot** | A free, open-source tool that automates obtaining and renewing SSL certificates from Let's Encrypt. |
| **Container** | A lightweight, self-contained package that includes an application and everything it needs to run (code, libraries, settings). Docker creates and manages containers. |
| **CesiumJS** | An open-source JavaScript library for creating 3D globes and maps in a web browser. Used by SoilFER-LIMS for the interactive field map. |
| **DNS** | Domain Name System — the internet's "phone book" that translates domain names (like `soillab.org`) into IP addresses (like `46.19.33.37`). |
| **Docker** | A platform for running applications inside containers. It packages the application with all its dependencies so it works the same everywhere. |
| **Docker Compose** | A tool for defining and running multi-container Docker applications using a YAML configuration file. |
| **Domain Name** | A human-readable address for a website (like `soillab.org`), registered through a domain registrar. |
| **FAO** | Food and Agriculture Organization of the United Nations — the UN agency leading the SoilFER programme. |
| **Firewall** | Software that controls which network connections are allowed in and out of a server. UFW is the default firewall on Ubuntu. |
| **Git** | A version control system used to track changes to code. Used to download and update SoilFER-LIMS from GitHub. |
| **GitHub** | A website that hosts Git repositories (collections of code). SoilFER-LIMS code is stored here. |
| **GLOSOLAN** | Global Soil Laboratory Network — a network of ~1000 soil labs in 155 countries, coordinated by FAO. |
| **GSP** | Global Soil Partnership — a voluntary partnership hosted by FAO to promote sustainable soil management worldwide. |
| **HTTPS** | Hypertext Transfer Protocol Secure — encrypted web communication. Indicated by a green 🔒 lock icon in browsers. |
| **IP Address** | A numerical address that identifies a device on the internet (like `46.19.33.37`). Your server has one. |
| **JWT** | JSON Web Token — a secure way to handle user authentication (login sessions) in web applications. |
| **Let's Encrypt** | A free, nonprofit certificate authority that provides SSL/TLS certificates for HTTPS. |
| **LIMS** | Laboratory Information Management System — software for managing laboratory operations and data. |
| **MIR** | Mid-Infrared — a type of infrared spectroscopy used for soil analysis. |
| **NGINX** | A high-performance web server used as a reverse proxy — it receives web requests and forwards them to the application. |
| **NIR** | Near-Infrared — a type of infrared spectroscopy used for rapid soil analysis. |
| **Node.js** | A JavaScript runtime that allows running JavaScript code on a server (not just in a browser). SoilFER-LIMS's backend is built with Node.js. |
| **Prisma** | An ORM (Object-Relational Mapping) — a tool that lets the application interact with the database using JavaScript instead of SQL. |
| **RBAC** | Role-Based Access Control — a security model where permissions are assigned based on user roles (like Lab Manager, Technician). |
| **React** | A JavaScript library for building user interfaces. SoilFER-LIMS's frontend is built with React. |
| **Reverse Proxy** | A server that sits between the internet and your application, forwarding requests. NGINX serves this role. |
| **SoilFER** | Soil Mapping for Resilient Agrifood Systems — an FAO programme for building soil information systems and improving fertilizer recommendations. |
| **SOP** | Standard Operating Procedure — a documented set of instructions for performing a specific task consistently. |
| **SQLite** | A lightweight, file-based database. Unlike PostgreSQL or MySQL, it doesn't need a separate database server — all data is in a single file. |
| **SSH** | Secure Shell — a protocol for securely connecting to a remote server and executing commands. |
| **SSL/TLS** | Secure Sockets Layer / Transport Layer Security — encryption protocols used by HTTPS. |
| **Subdomain** | A prefix added to a domain name, creating a separate address. For example, `lims.your-institute.org` is a subdomain of `your-institute.org`. |
| **UFW** | Uncomplicated Firewall — a simple firewall tool included with Ubuntu Linux. |
| **Vite** | A modern build tool for JavaScript applications. Used to build the SoilFER-LIMS frontend. |
| **Volume (Docker)** | A persistent storage area that keeps data even when containers are rebuilt or restarted. Your database lives in a Docker volume. |
| **VPS** | Virtual Private Server — a virtual machine rented from a hosting provider, used to run web applications. |
| **WebSocket** | A communication protocol that enables real-time, two-way communication between a browser and server. Used for notifications. |
