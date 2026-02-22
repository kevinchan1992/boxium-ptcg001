import { registerUser } from "./server/auth.ts";

async function testRegister() {
  console.log("Testing registration...");
  
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = "TestPass123";
  const testName = "Test User";
  
  console.log(`Email: ${testEmail}`);
  console.log(`Password: ${testPassword}`);
  console.log(`Name: ${testName}`);
  
  try {
    const result = await registerUser(testEmail, testPassword, testName);
    
    if (result.success) {
      console.log("✅ Registration successful!");
      console.log("User:", result.user);
      console.log("Token:", result.token ? "Generated" : "Missing");
    } else {
      console.log("❌ Registration failed!");
      console.log("Error:", result.error);
    }
  } catch (error) {
    console.error("❌ Exception during registration:");
    console.error(error);
  }
  
  process.exit(0);
}

testRegister();
