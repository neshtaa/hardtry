# Wormix-Like Game

Покрокова 2D аркадна артилерійська гра в стилі Wormix / Worms у браузері з модульною архітектурою (Phaser 3 + TypeScript) та опціональним FastAPI бекендом.

---

## 🛠 Технологічний стек

### **Frontend & Game Engine (`client/`)**
* **[Phaser 3](https://phaser.io/) (`^3.80.1`)** — 2D ігровий рушій (процедурний рендеринг рельєфу, деструкція ландшафту, фізика снарядів, анімації).
* **[TypeScript](https://www.typescriptlang.org/) (`^5.6.3`)** — строго типізована розробка ігрових компонентів та моделей.
* **[Vite](https://vitejs.dev/) (`^6.0.0`)** — надшвидкий dev-сервер та бандлер для браузера.
* **[React 18](https://react.dev/)** — UI компоненти та обгортка.
* **[Electron](https://www.electronjs.org/) (`^33.2.0`)** — можливість збірки десктопного додатка (Linux, Windows, macOS).

### **Backend (`backend/`)**
* **[Python 3.11+](https://www.python.org/)**
* **[FastAPI](https://fastapi.tiangolo.com/) (`>=0.115.0`)** — асинхронний REST API для віддання ігрового контенту (зброя, місії, класи юнітів).
* **[Pydantic V2](https://docs.pydantic.dev/)** — строга валідація схем ігрових JSON-конфігів.
* **[Uvicorn](https://www.uvicorn.org/)** — асинхронний ASGI сервер.

### **Спільні дані та контент (`shared/` & `content/`)**
* **`shared/types.ts`** — єдине джерело правди для типів даних (місії, характеристики зброї, архетипи бійців).
* **`content/`** — конфігураційні JSON файли (`weapons.json`, `missions.json`, `unit_classes.json`).

---

## 🚀 Як запустити проєкт у браузері

### **Варіант 1. Швидкий запуск клієнта (Автономний режим у браузері)**

Клієнт підтримує автоматичний fallback: якщо бекенд не запущено, гра завантажує локальні конфігурації та працює повноцінно.

1. Перейдіть у директорію `client` та встановіть залежності:
   ```bash
   cd client
   npm install
   ```

2. Запустіть dev-сервер Vite:
   ```bash
   npm run dev
   ```

3. Перейдіть за адресою в браузері:  
   👉 **`http://localhost:5173`**

---

### **Варіант 2. Повний запуск (Бекенд API + Клієнт у браузері)**

#### **Крок 1: Запуск FastAPI Backend**
У першому вікні термінала:
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # На Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
*API буде доступне за адресою `http://localhost:8000`, а інтерактивна документація Swagger — за `http://localhost:8000/docs`.*

#### **Крок 2: Запуск Frontend Клієнта**
У другому вікні термінала:
```bash
cd client
npm run dev
```

Відкрийте браузер за адресою **`http://localhost:5173`**.

---

### **Варіант 3. Запуск через Docker Compose**

Для одночасного запуску бекенду та клієнта в ізольованому середовищі:

```bash
docker-compose up --build
```

Відкрийте у браузері: **`http://localhost:5173`**.

---

## 📋 Основні NPM-команди (`client/`)

| Команда | Опис |
| :--- | :--- |
| `npm run dev` | Запуск розробницького сервера Vite для браузера (`http://localhost:5173`) |
| `npm run type-check` | Перевірка станичної типізації TypeScript (`tsc --noEmit`) |
| `npm run build` | Збірка продакшн-бандлу Vite та десктопного дистрибутиву Electron |
| `npm run start` | Запуск локальної Electron-версії клієнта |
