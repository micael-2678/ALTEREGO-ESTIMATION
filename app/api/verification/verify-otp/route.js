import { json, preflight, handler, readJson, safeEqual } from '@/lib/api-helpers';
import { getCollection } from '@/lib/mongodb';
import { normalizePhoneNumber, shouldBypassVerification, isOTPExpired } from '@/lib/otp-service';
import { PHONE_VERIFICATION_VALIDITY_MS } from '@/lib/server/leads';

export const OPTIONS = preflight;

// Vérification du code OTP
export const POST = handler(async (request) => {
  const { phone, code } = await readJson(request);
  if (!phone || !code) {
    return json(request, { error: 'Phone and code are required' }, 400);
  }

  if (shouldBypassVerification(phone)) {
    return json(request, { success: true, verified: true, bypass: true });
  }

  const normalizedPhone = normalizePhoneNumber(phone);
  const collection = await getCollection('otp_verifications');
  const otpRecord = await collection.findOne({ phone: normalizedPhone, verified: false });

  if (!otpRecord) {
    return json(request, { error: 'Aucune vérification en cours pour ce numéro.' }, 404);
  }

  if (isOTPExpired(otpRecord.expiresAt)) {
    await collection.deleteOne({ _id: otpRecord._id });
    return json(request, { error: 'Le code a expiré. Demandez-en un nouveau.' }, 400);
  }

  const maxAttempts = parseInt(process.env.MAX_OTP_ATTEMPTS) || 5;
  if (otpRecord.attempts >= maxAttempts) {
    await collection.deleteOne({ _id: otpRecord._id });
    return json(request, { error: 'Trop de tentatives. Demandez un nouveau code.' }, 429);
  }

  if (!safeEqual(String(code), otpRecord.code)) {
    await collection.updateOne({ _id: otpRecord._id }, { $inc: { attempts: 1 } });
    return json(request, {
      error: 'Code incorrect.',
      attemptsRemaining: maxAttempts - otpRecord.attempts - 1
    }, 400);
  }

  await collection.updateOne(
    { _id: otpRecord._id },
    // Le document vérifié doit survivre à l'index TTL le temps de créer le lead
    { $set: { verified: true, verifiedAt: new Date(), expiresAt: new Date(Date.now() + PHONE_VERIFICATION_VALIDITY_MS) } }
  );
  return json(request, { success: true, verified: true });
});
