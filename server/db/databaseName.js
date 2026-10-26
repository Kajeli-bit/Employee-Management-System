const PRODUCTION_DATABASE = "ems";
const DEVELOPMENT_DATABASE = "test";

export const databaseNameForRuntime = (environment = process.env) => {
  if (environment.VERCEL || environment.AWS_LAMBDA_FUNCTION_NAME) {
    return PRODUCTION_DATABASE;
  }

  return DEVELOPMENT_DATABASE;
};

export const DATABASE_NAMES = {
  production: PRODUCTION_DATABASE,
  development: DEVELOPMENT_DATABASE,
};
