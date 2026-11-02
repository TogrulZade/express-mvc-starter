export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  const duplicate = err.code === 'P2002' || err.code === 11000 || err.name === 'SequelizeUniqueConstraintError';
  const candidate = err.statusCode || err.status;
  const statusCode = duplicate ? 409 : Number.isInteger(candidate) && candidate >= 400 && candidate <= 599 ? candidate : 500;
  if (statusCode >= 500) console.error(err.stack || err);
  const message = duplicate ? 'Email already exists' :
    err.type === 'entity.parse.failed' ? 'Invalid JSON body' :
    err.type === 'entity.too.large' ? 'Request body too large' :
    statusCode >= 500 ? 'Internal Server Error' : err.message || 'Request failed';
  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
