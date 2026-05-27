import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import fs from "fs";

// Initialize SQLite database
const dbPath = path.join(process.cwd(), 'news.db');
const db = new Database(dbPath);

// Create table if not exists
db.exec(`
  CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    content TEXT,
    image_url TEXT,
    category TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Seed initial data if empty
const count = db.prepare('SELECT count(*) as count FROM articles').get() as { count: number };
if (count.count === 0) {
  const insert = db.prepare('INSERT INTO articles (title, content, image_url, category) VALUES (?, ?, ?, ?)');
  
  const sampleArticles = [
    {
      title: 'ఏపీలో భారీ వర్షాలు: పలు జిల్లాల్లో రెడ్ అలర్ట్',
      content: 'బంగాళాఖాతంలో ఏర్పడిన అల్పపీడనం కారణంగా ఆంధ్రప్రదేశ్ వ్యాప్తంగా మూడు రోజుల పాటు భారీ వర్షాలు కురుస్తాయని వాతావరణ శాఖ హెచ్చరించింది. ముఖ్యంగా కోస్తా జిల్లాలకు రెడ్ అలర్ట్ జారీ చేసింది.',
      image_url: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=800&q=80',
      category: 'రాష్ట్రం' // State
    },
    {
      title: 'కొత్త ఉపాధి అవకాశాలు: ఐటీ రంగంలో నియామకాలు షురూ',
      content: 'కరోనా తర్వాత మందగించిన ఐటీ రంగం మళ్ళీ పుంజుకుంటోంది. ప్రముఖ ఐటీ కంపెనీలు ఈ త్రైమాసికంలో కొత్తగా వేలాది మందిని నియమించుకోనున్నట్లు ప్రకటించాయి.',
      image_url: 'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=800&q=80',
      category: 'వ్యాపారం' // Business
    },
    {
      title: 'టీమిండియా అద్భుత విజయం: సగర్వంగా నిలిచిన క్రీడాకారులు',
      content: 'ఆస్ట్రేలియాతో జరిగిన ఉత్కంఠభరిత ఫైనల్ మ్యాచ్‌లో భారత జట్టు అద్భుత ప్రదర్శనతో విజయం సాధించింది. ఆటగాళ్ల కృషికి దేశ వ్యాప్తంగా ప్రశంసల జల్లు కురుస్తోంది.',
      image_url: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&q=80',
      category: 'క్రీడలు' // Sports
    },
    {
      title: 'ఈ వారం రెండు భారీ సినిమాలు విడుదలయ్యాక టాలీవుడ్ సందడి',
      content: 'సంక్రాంతి పండుగ సందర్భంగా రెండు భారీ బడ్జెట్ సినిమాలు ఈ వారం ప్రేక్షకుల ముందుకు వస్తున్నాయి. ఈ రెండు చిత్రాలపై అభిమానులు భారీ అంచనాలతో ఎదురు చూస్తున్నారు.',
      image_url: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=800&q=80',
      category: 'సినీ వినోదం' // Entertainment
    }
  ];

  const insertTransaction = db.transaction((articles) => {
    for (const article of articles) {
      insert.run(article.title, article.content, article.image_url, article.category);
    }
  });

  insertTransaction(sampleArticles);
}


async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API ROUTES
  app.get('/api/news', (req, res) => {
    try {
      const { category } = req.query;
      let stmt = db.prepare('SELECT id, title, content, image_url, category, created_at FROM articles ORDER BY created_at DESC');
      if (category && category !== 'All') {
         stmt = db.prepare('SELECT id, title, content, image_url, category, created_at FROM articles WHERE category = ? ORDER BY created_at DESC');
         const articles = stmt.all(category);
         res.json({ articles });
         return;
      }
      
      const articles = stmt.all();
      res.json({ articles });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/news/:id', (req, res) => {
    try {
      const stmt = db.prepare('SELECT id, title, content, image_url, category, created_at FROM articles WHERE id = ?');
      const article = stmt.get(req.params.id);
      if (article) {
        res.json({ article });
      } else {
        res.status(404).json({ error: 'Article not found' });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/news', (req, res) => {
    try {
      const { title, content, image_url, category } = req.body;
      if (!title || !content || !category) {
        res.status(400).json({ error: 'Title, content, and category are required' });
        return;
      }
      
      const insert = db.prepare('INSERT INTO articles (title, content, image_url, category) VALUES (?, ?, ?, ?)');
      const result = insert.run(title, content, image_url || '', category);
      
      res.status(201).json({ id: result.lastInsertRowid, message: 'Article created successfully' });
    } catch (e: any) {
       res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/news/:id', (req, res) => {
    try {
      const stmt = db.prepare('DELETE FROM articles WHERE id = ?');
      const result = stmt.run(req.params.id);
      
      if (result.changes > 0) {
        res.json({ message: 'Article deleted successfully' });
      } else {
        res.status(404).json({ error: 'Article not found' });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Database stats for dashboard
  app.get('/api/stats', (req, res) => {
     try {
       const articleCount = db.prepare('SELECT count(*) as count FROM articles').get() as { count: number };
       res.json({ totalArticles: articleCount.count });
     } catch (e: any) {
       res.status(500).json({ error: e.message });
     }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
