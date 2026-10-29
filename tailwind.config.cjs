        module.exports = {
            content: ['./index.html', './assets/js/**/*.js'],
            safelist: ['active-pc', 'active-xbox', 'active-ps', 'active-switch'],
            darkMode: 'class',
            theme: {
                extend: {
                    colors: {
                        steam: {
                            bg: '#0b0f19',
                            dark: '#111827',
                            base: '#162032',
                            card: '#131c2e',
                            light: '#24344d',
                            blue: '#38bdf8',
                            blueHover: '#0284c7',
                            green: '#a4d007',
                            greenBg: '#4c6b22',
                            emerald: '#10b981',
                            gold: '#f59e0b',
                            purple: '#8b5cf6'
                        }
                    },
                    fontFamily: {
                        sans: ['Inter', 'sans-serif'],
                        display: ['Plus Jakarta Sans', 'sans-serif']
                    }
                }
            }
        }
