/**
 * تبدیل تمام ارقام فارسی و عربی به ارقام استاندارد انگلیسی
 */
export function convertToEnglishDigits(input?: string): string {
  if (!input) return '';

  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

  return input
    .split('')
    .map((char) => {
      const pIndex = persianDigits.indexOf(char);
      if (pIndex > -1) return pIndex.toString();

      const aIndex = arabicDigits.indexOf(char);
      if (aIndex > -1) return aIndex.toString();

      return char;
    })
    .join('')
    .trim();
}
