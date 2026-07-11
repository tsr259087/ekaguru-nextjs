"use client";

import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { auth } from "./firebase";

// Call this once, e.g. on your login page, pointing at an invisible container div:
// <div id="recaptcha-container"></div>
export function setupRecaptcha() {
  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
      size: "invisible",
    });
  }
  return window.recaptchaVerifier;
}

// Step 1: send the OTP. phoneNumber must be E.164 format, e.g. "+919876543210"
export async function sendOtp(phoneNumber) {
  const verifier = setupRecaptcha();
  const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, verifier);
  window.confirmationResult = confirmationResult; // needed for step 2
  return confirmationResult;
}

// Step 2: verify the code the user typed in
export async function verifyOtp(code) {
  if (!window.confirmationResult) {
    throw new Error("No OTP was sent yet — call sendOtp first.");
  }
  const result = await window.confirmationResult.confirm(code);
  return result.user; // Firebase Auth user, with a stable uid you use as the Firestore doc ID
}
