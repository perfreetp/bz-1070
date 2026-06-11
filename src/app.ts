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
const PORT = parseInt(process.env.PORT || '3000') || 3000;

app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Token', 'Device-Token'],
  maxAge: 86400
}));

app.use((req: Request, res: Response, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));
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
