import express from 'express';
import routes from './routes/index';

const app = express();

app.use(express.json());

app.use(routes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port: ${PORT}`);
});

export default app;
