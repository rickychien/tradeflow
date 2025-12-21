# TradeFlow Journal 🚀

**The Professional's Edge in Trading Performance.**

TradeFlow is a privacy-focused, local-first trading journal and performance analytics dashboard designed for serious traders. It integrates directly with OANDA for trade history, utilizes Gemini AI for performance coaching, and allows you to define and track your "Playbook" of strategies.

![TradeFlow Dashboard](https://images.unsplash.com/photo-1611974765270-ca1258634369?auto=format&fit=crop&q=80&w=1200&h=400)

## ✨ Key Features

### 📊 Performance Dashboard
- **Real-time Metrics**: Win Rate, Profit Factor, Sharpe Ratio, and Expectancy.
- **Visual Analytics**: Interactive Equity Curve (Lightweight Charts) and Calendar Heatmap of P&L.
- **Daily Drawdown Tracking**: Monitor your discipline with daily P&L limits.

### 📝 Smart Journaling
- **OANDA Sync**: Automatically fetch your trade history from OANDA (Live & Practice accounts).
- **Enrichment**: Tag trades with your custom strategies, emotions (FOMO, Greed, Zen), and mistakes.
- **AI Reviews**: Get instant feedback on your trade execution using Gemini AI.

### 📘 The Playbook
- **Strategy Definition**: Clearly define your setups with Entry and Exit rules.
- **Optimization**: Edit strategies without breaking historical data.
- **Tracking**: Filter your journal by specific Playbook strategies to see what's working.

### 🔒 Privacy & Data Ownership
- **Local-First**: All your sensitive data (API keys, notes, strategies) lives in your browser's LocalStorage.
- **Auto-Sync**: Seamlessly backup your data to a local JSON file (e.g., in Google Drive/Dropbox) using the File System Access API.
- **Zero Server Config**: No database to manage, no monthly subscription fees.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- An OANDA Account (optional, for auto-import)
- A Google Gemini API Key (optional, for AI features)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/tradeflow.git
   cd tradeflow
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Run Locally**
   ```bash
   npm run dev
   ```

## ⚙️ Configuration

### 1. Connect OANDA (Optional)
Go to **Settings > Market Data Provider**.
- **API Key**: Generate from your OANDA portal.
- **Account ID**: Your 16-digit account number (e.g., `001-001-1234567-001`).
- **Environment**: Select Live or Practice.

### 2. Enable Auto-Backup
Go to **Settings > Data Management**.
- Click **Connect File**.
- Select a folder (e.g., Documents or Google Drive).
- Create a new file (e.g., `tradeflow_data.json`).
- **Done!** Every change you make is now automatically saved to that file.

### 3. Setup AI Coach
Go to **Settings > AI Coach**.
- Enter your **Gemini API Key**.
- This enables the "Analyze Trade" button in the Journal to give you R-multiple based feedback.

## 🛠 Tech Stack

- **Framework**: React + Vite (TypeScript)
- **Styling**: Tailwind CSS
- **Charts**: Lightweight Charts (TradingView) + Recharts
- **Storage**: LocalStorage + File System Access API (idb-keyval)
- **Icons**: Lucide React
- **AI**: Google Generative AI SDK

## 🤝 Contributing

Contributions are welcome! Please fork the repository and submit a pull request for any features or bug fixes.

---

**Disclaimer**: This application is for educational and performance tracking purposes only. Trading foreign exchange on margin carries a high level of risk.
