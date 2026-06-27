import 'dotenv/config';

async function checkEnv() {
  try {
    // Import env.ts to trigger validation
    await import('../src/constants/env.js');
    console.log('✅ Environment variables are valid!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Environment validation failed:');
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

checkEnv();
