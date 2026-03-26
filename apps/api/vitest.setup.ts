process.env.NODE_ENV = 'test';
process.env.PORT = '3000';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-jwt-secret-must-be-32-chars!';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-32-chars-ok!';
process.env.CORS_ORIGIN = 'http://localhost:5173';
process.env.ADMIN_SECRET = 'test-admin-secret-with-32-chars!!';
