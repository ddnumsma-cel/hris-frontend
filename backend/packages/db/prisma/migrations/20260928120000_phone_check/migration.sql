-- Phone clock-in confirmed by the phone's own lock (temporary, until the attendance machines are chosen).
ALTER TYPE "VerifyMode" ADD VALUE 'PHONE_BIOMETRIC';
ALTER TYPE "VerifyMode" ADD VALUE 'PHONE_PASSCODE';
