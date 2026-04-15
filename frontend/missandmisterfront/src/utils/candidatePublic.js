export const getCandidatePublicIdentifier = (candidate = {}) => {
  const publicUid = String(candidate?.public_uid || candidate?.publicUid || '').trim();
  if (publicUid) {
    return publicUid;
  }

  const slug = String(candidate?.slug || '').trim();
  if (slug) {
    return slug;
  }

  const publicNumber = Number(candidate?.public_number);
  if (Number.isFinite(publicNumber) && publicNumber > 0) {
    return String(Math.trunc(publicNumber));
  }

  return '';
};

export const getCandidatePublicPath = (candidate = {}) => {
  const identifier = getCandidatePublicIdentifier(candidate);
  return identifier ? `/candidates/${encodeURIComponent(identifier)}` : '/candidates';
};

export const formatCandidatePublicNumber = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return '—';
  }

  return String(Math.trunc(number)).padStart(2, '0');
};
