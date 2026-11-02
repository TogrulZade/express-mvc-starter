import { createApp } from '@st/http';
import routes from './routes/index.js';

// Helmet, CORS, body parsers, rate limit, 404 and error responses come from @st/http.
// Tests import this file without opening a port.
export default await createApp({ routes });
