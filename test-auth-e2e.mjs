/**
 * End-to-end authentication test
 * Tests the complete registration and login flow including session cookies
 */

const BASE_URL = "http://localhost:3000";

async function testRegister() {
  console.log("\n=== Testing Registration ===");
  
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = "TestPass123";
  const testName = "E2E Test User";
  
  console.log(`Email: ${testEmail}`);
  console.log(`Password: ${testPassword}`);
  console.log(`Name: ${testName}`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/trpc/auth.register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        name: testName,
      }),
    });
    
    const data = await response.json();
    console.log("Response status:", response.status);
    console.log("Response data:", JSON.stringify(data, null, 2));
    
    // Check for session cookie
    const cookies = response.headers.get("set-cookie");
    console.log("Set-Cookie header:", cookies);
    
    if (response.ok && data.result?.data?.success) {
      console.log("✅ Registration successful!");
      console.log("User:", data.result.data.user);
      console.log("Token:", data.result.data.token ? "Generated" : "Missing");
      console.log("Session cookie:", cookies ? "Set" : "Not set");
      return { success: true, email: testEmail, password: testPassword };
    } else {
      console.log("❌ Registration failed!");
      console.log("Error:", data.error || data);
      return { success: false };
    }
  } catch (error) {
    console.error("❌ Exception during registration:");
    console.error(error);
    return { success: false };
  }
}

async function testLogin(email, password) {
  console.log("\n=== Testing Login ===");
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/trpc/auth.login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });
    
    const data = await response.json();
    console.log("Response status:", response.status);
    console.log("Response data:", JSON.stringify(data, null, 2));
    
    // Check for session cookie
    const cookies = response.headers.get("set-cookie");
    console.log("Set-Cookie header:", cookies);
    
    if (response.ok && data.result?.data?.success) {
      console.log("✅ Login successful!");
      console.log("User:", data.result.data.user);
      console.log("Token:", data.result.data.token ? "Generated" : "Missing");
      console.log("Session cookie:", cookies ? "Set" : "Not set");
      return { success: true };
    } else {
      console.log("❌ Login failed!");
      console.log("Error:", data.error || data);
      return { success: false };
    }
  } catch (error) {
    console.error("❌ Exception during login:");
    console.error(error);
    return { success: false };
  }
}

async function runTests() {
  console.log("Starting end-to-end authentication tests...\n");
  
  // Test registration
  const registerResult = await testRegister();
  
  if (!registerResult.success) {
    console.log("\n❌ Registration test failed. Stopping tests.");
    process.exit(1);
  }
  
  // Test login with the registered user
  const loginResult = await testLogin(registerResult.email, registerResult.password);
  
  if (!loginResult.success) {
    console.log("\n❌ Login test failed.");
    process.exit(1);
  }
  
  console.log("\n✅ All authentication tests passed!");
  process.exit(0);
}

runTests();
