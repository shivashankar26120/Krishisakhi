'use strict';

/**
 * Seed file: starter government schemes.
 * Safe to re-run — skips existing rows by scheme_name.
 */
exports.seed = async function (knex) {
  const schemes = [
    {
      scheme_name: 'PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)',
      scheme_name_kn: 'ಪ್ರಧಾನ ಮಂತ್ರಿ ಕಿಸಾನ್ ಸಮ್ಮಾನ್ ನಿಧಿ',
      ministry: 'Ministry of Agriculture & Farmers Welfare',
      scheme_type: 'subsidy',
      description: 'Income support of ₹6,000 per year to all landholding farmer families in three equal installments.',
      description_kn: 'ಎಲ್ಲಾ ಭೂಮಿ ಹೊಂದಿರುವ ರೈತ ಕುಟುಂಬಗಳಿಗೆ ವರ್ಷಕ್ಕೆ ₹6,000 ಆದಾಯ ಬೆಂಬಲ.',
      eligibility: 'All landholding farmers with cultivable land.',
      eligibility_kn: 'ಕೃಷಿ ಭೂಮಿ ಹೊಂದಿರುವ ಎಲ್ಲಾ ರೈತರು.',
      benefits: '₹6,000 per year in 3 instalments of ₹2,000 each.',
      benefits_kn: '₹2,000 ತಲಾ 3 ಕಂತುಗಳಲ್ಲಿ ವರ್ಷಕ್ಕೆ ₹6,000.',
      application_url: 'https://pmkisan.gov.in',
      is_central: true,
      is_active: true,
    },
    {
      scheme_name: 'PM Fasal Bima Yojana (PMFBY)',
      scheme_name_kn: 'ಪ್ರಧಾನ ಮಂತ್ರಿ ಫಸಲ್ ಬಿಮಾ ಯೋಜನೆ',
      ministry: 'Ministry of Agriculture & Farmers Welfare',
      scheme_type: 'insurance',
      description: 'Crop insurance scheme to provide financial support to farmers in case of crop failure due to natural calamities, pests & diseases.',
      description_kn: 'ನೈಸರ್ಗಿಕ ವಿಕೋಪ, ಕೀಟ ಮತ್ತು ರೋಗಗಳಿಂದ ಬೆಳೆ ನಷ್ಟ ಸಂಭವಿಸಿದಾಗ ರೈತರಿಗೆ ಆರ್ಥಿಕ ನೆರವು ನೀಡುವ ಯೋಜನೆ.',
      eligibility: 'All farmers growing notified crops in notified areas.',
      eligibility_kn: 'ಅಧಿಸೂಚಿತ ಪ್ರದೇಶಗಳಲ್ಲಿ ಅಧಿಸೂಚಿತ ಬೆಳೆ ಬೆಳೆಯುವ ಎಲ್ಲಾ ರೈತರು.',
      benefits: 'Insurance coverage against crop loss. Premium as low as 2% for Kharif, 1.5% for Rabi.',
      benefits_kn: 'ಬೆಳೆ ನಷ್ಟಕ್ಕೆ ವಿಮಾ ರಕ್ಷಣೆ. ಖರೀಫ್‌ಗೆ 2%, ರಬಿಗೆ 1.5% ಪ್ರೀಮಿಯಂ.',
      application_url: 'https://pmfby.gov.in',
      is_central: true,
      is_active: true,
    },
    {
      scheme_name: 'Kisan Credit Card (KCC)',
      scheme_name_kn: 'ಕಿಸಾನ್ ಕ್ರೆಡಿಟ್ ಕಾರ್ಡ್',
      ministry: 'Ministry of Agriculture & Farmers Welfare',
      scheme_type: 'loan',
      description: 'Provides short-term credit requirements of farmers for cultivation of crops and allied activities.',
      description_kn: 'ಬೆಳೆ ಕೃಷಿ ಮತ್ತು ಸಂಬಂಧಿತ ಚಟುವಟಿಕೆಗಳಿಗೆ ರೈತರ ಅಲ್ಪಾವಧಿ ಸಾಲದ ಅವಶ್ಯಕತೆಗಳನ್ನು ಪೂರೈಸುತ್ತದೆ.',
      eligibility: 'All farmers, sharecroppers, oral lessees and self-help groups.',
      eligibility_kn: 'ಎಲ್ಲಾ ರೈತರು, ಪಾಲು ಬೆಳೆಗಾರರು, ಮೌಖಿಕ ಗೇಣಿದಾರರು ಮತ್ತು ಸ್ವ-ಸಹಾಯ ಸಂಘಗಳು.',
      benefits: 'Flexible credit up to ₹3 lakh at subsidised interest rate of 7%. Additional 3% subvention for timely repayment.',
      benefits_kn: '7% ರಿಯಾಯಿತಿ ಬಡ್ಡಿ ದರದಲ್ಲಿ ₹3 ಲಕ್ಷ ವರೆಗೆ ಹೊಂದಿಕೊಳ್ಳಬಲ್ಲ ಸಾಲ.',
      application_url: 'https://www.nabard.org/content.aspx?id=568',
      is_central: true,
      is_active: true,
    },
    {
      scheme_name: 'Karnataka Raitha Siri (State Scheme)',
      scheme_name_kn: 'ಕರ್ನಾಟಕ ರೈತ ಸಿರಿ',
      ministry: 'Karnataka Department of Agriculture',
      scheme_type: 'subsidy',
      description: 'Karnataka state scheme providing input subsidies and crop support to small and marginal farmers.',
      description_kn: 'ಕರ್ನಾಟಕದ ಸಣ್ಣ ಮತ್ತು ಅತಿ ಸಣ್ಣ ರೈತರಿಗೆ ಒಳಸುರಿ ಸಬ್ಸಿಡಿ ಮತ್ತು ಬೆಳೆ ಬೆಂಬಲ.',
      eligibility: 'Small and marginal farmers in Karnataka with land holding up to 5 acres.',
      eligibility_kn: '5 ಎಕರೆ ವರೆಗೆ ಭೂ ಹಿಡುವಳಿ ಇರುವ ಕರ್ನಾಟಕದ ಸಣ್ಣ ಮತ್ತು ಅತಿ ಸಣ್ಣ ರೈತರು.',
      benefits: 'Input subsidies on seeds, fertilizers, and farm equipment.',
      benefits_kn: 'ಬೀಜ, ಗೊಬ್ಬರ ಮತ್ತು ಕೃಷಿ ಸಾಧನಗಳ ಮೇಲೆ ಒಳಸುರಿ ಸಬ್ಸಿಡಿ.',
      application_url: 'https://raitamitra.karnataka.gov.in',
      applicable_states: ['Karnataka'],
      is_central: false,
      is_active: true,
    },
  ];

  for (const scheme of schemes) {
    const exists = await knex('government_schemes')
      .where('scheme_name', scheme.scheme_name)
      .first();
    if (!exists) {
      await knex('government_schemes').insert(scheme);
    }
  }
};
