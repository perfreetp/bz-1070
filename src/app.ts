import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import './database/associations';
import { requestLogger, notFoundHandler, errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth';
import childRoutes from './routes/child';
import deviceRoutes from './routes/device';
import locationRoutes from './routes/location';
import geofenceRoutes from './routes/geofence';
import alertRoutes from './routes/alert';
import guardianRoutes from './routes/guardian';
import rescueRoutes from './routes/rescue';
import statsRoutes from './routes/stats';
import checkInRoutes from './routes/checkIn';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000');

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'child-safety-backend',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/children', childRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/geofences', geofenceRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/guardians', guardianRoutes);
app.use('/api/rescue', rescueRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/checkin', checkInRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
export { PORT };
