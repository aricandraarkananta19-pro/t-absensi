import { z } from "zod";

const passwordSchema = z.string()
    .min(8, "Password minimal 8 karakter")
    .regex(/[A-Z]/, "Harus ada huruf besar (A-Z)")
    .regex(/[a-z]/, "Harus ada huruf kecil (a-z)")
    .regex(/[0-9]/, "Harus ada angka (0-9)")
    .regex(/[!@#$%^&*(),.?":{}|<>_\-+=]/, "Harus ada karakter khusus (!@#$%...)");

const testCases = [
    { p: "password", valid: false, desc: "Only lowercase" },
    { p: "Password123", valid: false, desc: "Missing special char" },
    { p: "password123!", valid: false, desc: "Missing uppercase" },
    { p: "PASSWORD123!", valid: false, desc: "Missing lowercase" },
    { p: "Pass1!", valid: false, desc: "Too short" },
    { p: "Password123!", valid: true, desc: "Valid password" },
    { p: "StrongP@ssw0rd", valid: true, desc: "Valid complex password" }
];

console.log("Testing Password Policy...");
let passed = 0;
let failed = 0;

testCases.forEach(({ p, valid, desc }) => {
    const result = passwordSchema.safeParse(p);
    const isExpected = result.success === valid;

    if (isExpected) {
        console.log(`✅ [PASS] ${desc}: "${p}" -> ${result.success ? "Valid" : "Invalid"}`);
        passed++;
    } else {
        console.log(`❌ [FAIL] ${desc}: "${p}" expected ${valid} but got ${result.success}`);
        if (!result.success) {
            console.log("   Errors:", result.error.errors.map(e => e.message).join(", "));
        }
        failed++;
    }
});

console.log(`\nResult: ${passed}/${testCases.length} tests passed.`);
if (failed > 0) process.exit(1);
