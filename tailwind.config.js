/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#1E1D19',          // Основной текст — тёмно-коричневый (не чёрный)
          muted: '#6B6558',         // Второстепенный текст (насыщеннее)
          border: '#D4C9B0',        // Границы (хорошо видны)
          surface: '#FFFFFF',       // Белый фон карточек
          bg: '#F4F1EB',            // Тёплый кремовый фон страницы

          green: {
            DEFAULT: '#4A8C68',     // Насыщенный зеленый (кнопки, акцент)
            dark: '#2E7D5A',        // Ещё темнее для текста на светлом фоне
            bg: '#E0F2E9',          // Светло-зелёный фон бейджа
            hover: '#3D7557',       // Hover-состояние
          },
          orange: {
            DEFAULT: '#C47F2A',     // Янтарно-оранжевый
            bg: '#FFF0D6',
            hover: '#AA6B1E',
          },
          beige: {
            DEFAULT: '#B8965A',     // Земляной бежевый (насыщеннее)
            bg: '#F6EDDB',
            hover: '#A07E47',
          },
          red: {
            DEFAULT: '#C0392B',     // Тревожный красный
            bg: '#FDECEA',
            hover: '#A93224',
          },
        }
      },
      fontSize: {
        'xs':   ['0.8125rem', { lineHeight: '1.4' }],   // 13px
        'sm':   ['0.9375rem', { lineHeight: '1.5' }],   // 15px  (body text)
        'base': ['1rem',      { lineHeight: '1.6' }],   // 16px
        'lg':   ['1.125rem',  { lineHeight: '1.5' }],   // 18px
        'xl':   ['1.25rem',   { lineHeight: '1.4' }],   // 20px
        '2xl':  ['1.5rem',    { lineHeight: '1.3' }],   // 24px
        '3xl':  ['1.875rem',  { lineHeight: '1.2' }],   // 30px
      },
      borderRadius: {
        DEFAULT: '10px',
        card: '10px',
        btn: '10px',
        xl: '14px',
        '2xl': '18px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
