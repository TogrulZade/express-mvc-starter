import { Sequelize } from 'sequelize';

if (!process.env.DB_URI) throw new Error('DB_URI is required');
const sequelize = new Sequelize(process.env.DB_URI, { logging: false });

export default sequelize;
export const connectDB = () => sequelize.authenticate();
export const disconnectDB = () => sequelize.close();
