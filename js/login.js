(function(){
            const CORRECT_USER = 'cmk';
            const CORRECT_PASS = 'gordaerida';
            const STORAGE_KEY = 'cmk_logged_in';

            const overlay = document.getElementById('loginOverlay');
            const loginBtn = document.getElementById('loginBtn');
            const loginUser = document.getElementById('loginUser');
            const loginPass = document.getElementById('loginPass');
            const loginError = document.getElementById('loginError');
            const logoutBtn = document.getElementById('logoutBtn');
            const mainContainer = document.querySelector('.container');
            const sidebarContainer = document.querySelector('.sidebar-container'); // Nueva: Referencia al contenedor lateral

            // Mostrar overlay si no está logueado (sessionStorage para sesión del navegador)
            function isLoggedIn() {
                return sessionStorage.getItem(STORAGE_KEY) === 'true';
            }

            function showOverlay(show) {
                if (show) {
                    overlay.style.display = 'flex';
                    overlay.setAttribute('aria-hidden', 'false');
                    // evitar scroll al mostrarse
                    document.documentElement.style.overflow = 'hidden';
                    document.body.style.overflow = 'hidden';
                    // foco en usuario
                    setTimeout(()=> loginUser.focus(), 50);
                } else {
                    overlay.style.display = 'none';
                    overlay.setAttribute('aria-hidden', 'true');
                    document.documentElement.style.overflow = '';
                    document.body.style.overflow = '';
                }
            }

            function showLogoutButton(show) {
                logoutBtn.style.display = show ? 'block' : 'none';
                if (show) {
                    logoutBtn.textContent = 'Cerrar sesión';
                }
            }

            function showMainContent(show) {
                mainContainer.style.display = show ? 'grid' : 'none'; // Cambiado a 'grid'
                sidebarContainer.style.display = show ? 'flex' : 'none'; // AÑADE ESTA LÍNEA
            }

            function doLogin() {
                const u = (loginUser.value || '').trim();
                const p = (loginPass.value || '').trim();

                if (u === CORRECT_USER && p === CORRECT_PASS) {
                    sessionStorage.setItem(STORAGE_KEY, 'true');
                    loginError.textContent = '';
                    showOverlay(false);
                    showLogoutButton(true);
                    showMainContent(true);
                    // Llama a la función de inicialización de la app SOLO después del login exitoso
                    if (typeof window.initializeApp === 'function') {
                        window.initializeApp();
                    }
                } else {
                    loginError.textContent = 'Usuario o contraseña incorrectos.';
                    // pequeño shake visual (clase inline)
                    loginBoxAnimate();
                }
            }

            function loginBoxAnimate(){
                const box = document.getElementById('loginBox');
                if (!box) return;
                box.style.transition = 'transform 0.08s';
                box.style.transform = 'translateX(-8px)';
                setTimeout(()=>{ box.style.transform = 'translateX(8px)'; }, 80);
                setTimeout(()=>{ box.style.transform = ''; box.style.transition=''; }, 160);
            }

            function doLogout(){
                sessionStorage.removeItem(STORAGE_KEY);
                // Ocultar contenido principal y mostrar login
                showMainContent(false);
                showLogoutButton(false);
                showOverlay(true);
                // Limpiar campos de login
                loginUser.value = '';
                loginPass.value = '';
                loginError.textContent = '';
                // No recargar, solo cambiar visibilidad
            }

            // eventos
            loginBtn.addEventListener('click', doLogin);
            loginPass.addEventListener('keydown', function(e){
                if (e.key === 'Enter') doLogin();
            });
            loginUser.addEventListener('keydown', function(e){
                if (e.key === 'Enter') {
                    // pasar foco a pass
                    e.preventDefault();
                    loginPass.focus();
                }
            });
            logoutBtn.addEventListener('click', doLogout);

            // Inicialización al cargar la página
            document.addEventListener('DOMContentLoaded', () => {
                if (!isLoggedIn()) {
                    showOverlay(true);
                    showLogoutButton(false);
                    showMainContent(false); // Asegura que el contenido principal y el sidebar están ocultos
                } else {
                    showOverlay(false);
                    showLogoutButton(true);
                    showMainContent(true); // Muestra el contenido principal y el sidebar si ya está logueado
                    // Llama a la función de inicialización de la app si ya está logueado al cargar
                    if (typeof window.initializeApp === 'function') {
                        window.initializeApp();
                    }
                }
            });

            // Protección adicional: bloquear clicks y teclado cuando overlay visible
            overlay.addEventListener('keydown', (e)=> {
                // evitar que se propaguen atajos globales, etc.
                e.stopPropagation();
            });
            overlay.addEventListener('click', (e)=>{
                // clic fuera del cuadro no cierra ni hace nada
                e.stopPropagation();
            });
        })();