# 🐀 RatCode: Online Code Analysis & Transformation Tool
---

## 📚 Table of Contents

- [About RatCode](#about-ratcode)
- [Features](#features)
- [Live Demo](#live-demo)
- [Technologies Used](#technologies-used)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [Project Structure](#project-structure)
- [Known Limitations](#known-limitations)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

---

## 🧠 About RatCode

**RatCode** is a web-based tool designed for source code analysis and transformation. It provides real-time feedback on code structure, complexity, and logic patterns. While the current focus is on analysis, the architecture is designed to support future transformations and enhancements.

The application follows a clear separation of concerns:
- **Backend:** Node.js + Express handles logic, parsing, and analysis.
- **Frontend:** A clean and intuitive HTML/CSS UI enables easy code input.

---

## ✨ Features

- 📝 **Code Input Interface**: Users can paste or write code directly into the web form.
- ⚙️ **Language-Specific Analysis**:
  - **C++ & Java**: Identifies patterns like Optimal Binary Search Trees (OBST), max-value functions, loops, conditions, etc.
  - **Other Languages**: Heuristic-based complexity analysis via regular expressions.
- ⏱ **Time Complexity Estimation**: Provides rough Big-O notation based on code patterns.
- 📊 **Statistical Output**: Returns number of lines, comment ratio, token frequency, and more.
- 🔁 **Future-Proof Design**: Modular structure allows future addition of code transformation, refactoring, and export options.

---

## 🌐 Live Demo

Check it out here:  
🔗 [https://ratcode.onrender.com](https://ratcode.onrender.com)

---

## 🛠 Technologies Used

### Backend
- **Node.js** – JavaScript runtime
- **Express.js** – Backend framework
### Frontend
- **HTML/CSS/JS** – Lightweight form-based UI
- No framework dependency (no React/Vue used)

---

## 🚀 Getting Started

Follow these steps to run RatCode locally for development or testing.

### ✅ Prerequisites

- [Node.js](https://nodejs.org/) (LTS version recommended)
- npm (comes with Node.js)
- (Optional) MongoDB, if saving analysis data persistently

---

### 🖥 Backend Setup

```bash
# Clone the repository
git clone https://github.com/your-username/ratcode.git
cd ratcode/backend

# Install dependencies
npm install

# Run the server
node server.js
cd ../frontend  # from the root directory
```
# Do not open index.html directly in your browser as you could see cors permission issue
# follow the link provided during backend's server run to use the site
#This will usually open the application in your default web browser at http://localhost:3000 (or another available port). Ensure the frontend is configured to communicate with your running backend (the URL from step 3 of Backend Setup).
 --- 
ratcode/
├── backend/
│   ├── server.js
│   ├── package.json
└── frontend/
    ├── index.html
    ├── styles.css
    └── app.js

  ---

## ⚠️ Known Limitations

> **🔹 C++/Java Accuracy**: OBST and max-finding detection is pattern-based and may miss complex implementations.  
> **🔹 Heuristic Parsing**: For non-C++/Java languages, analysis is regex-driven and may yield approximate results.  
> **🔹 No AST Support Yet**: Lacks deeper semantic analysis via Abstract Syntax Trees *(planned for future versions)*.

---

## 🪪 License

**MIT License © 2025 prarthnat**

---

## 📬 Contact

💬 *Have questions or ideas?*  
Please open an issue in the [GitHub repository](#) or reach out via the contact section.
