export interface DlpCheckResult {
  flagged: boolean;
  reason?: string;
  matchedText?: string;
}

export class DlpService {
  private readonly patterns = {
    thaiNationalId: /\b[1-9]\d{12}\b/, // Thai National ID: 13 digits
    hospitalNumber: /\b(HN|hn)[-\s]?\d{6,8}\b/, // Hospital Number e.g. HN-123456
    phoneNumber: /\b(0[689]\d{8}|02\d{7})\b/, // Thai phones: 08XXXXXXXX, 06XXXXXXXX, 09XXXXXXXX, 02XXXXXXX
    passportNumber: /\b[A-Z0-9]{7,9}\b/, // Passport pattern placeholder
    labResultPattern: /\b(HbA1c|eGFR|WBC|RBC|Creatinine|BUN)\s*[:=]\s*\d+(\.\d+)?\b/i, // Lab results
  };

  analyze(content: string): DlpCheckResult {
    if (!content) return { flagged: false };

    for (const [key, regex] of Object.entries(this.patterns)) {
      const match = content.match(regex);
      if (match) {
        console.warn(`[DLP Warning] Triggered: Matched ${key} rule. Content contains sensitive patterns.`);
        return {
          flagged: true,
          reason: this.getReasonLabel(key),
          matchedText: match[0],
        };
      }
    }

    return { flagged: false };
  }

  private getReasonLabel(key: string): string {
    switch (key) {
      case 'thaiNationalId':
        return 'Thai National ID Number';
      case 'hospitalNumber':
        return 'Hospital Number (HN)';
      case 'phoneNumber':
        return 'Phone Number';
      case 'passportNumber':
        return 'Passport Number';
      case 'labResultPattern':
        return 'Clinical Laboratory Results';
      default:
        return 'Sensitive Patient Health Information (PHI)';
    }
  }
}

export const dlpService = new DlpService();
export default dlpService;
