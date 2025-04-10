/**
 * Ghibli HRM - Script thống nhất
 * Xử lý các tương tác giao diện người dùng, điều hướng trang và gửi form cho cấu trúc single-page.
 * Bao gồm cả logic cho trang Quản lý Đánh giá.
 */
document.addEventListener('DOMContentLoaded', function() {

    console.log('DOM đã tải xong. Khởi tạo script thống nhất cho Ghibli HRM...');

    // --- Biến và Hằng số ---
    const body = document.body;
    const pageContents = document.querySelectorAll('.page-content'); // Lấy tất cả các div nội dung trang
    const appContainer = document.querySelector('.app-container'); // Container chính của ứng dụng (sau đăng nhập)
    const authContainer = document.querySelector('.auth-container'); // Container cho các trang xác thực
    const sidebar = document.getElementById('sidebar'); // Phần tử sidebar
    const sidebarToggle = document.getElementById('sidebarToggle'); // Nút bật/tắt sidebar
    const userMenu = document.querySelector('.user-menu'); // Vùng user menu ở header
    const userDropdown = document.querySelector('.user-dropdown'); // Dropdown đăng xuất
    const mainContentArea = document.querySelector('.main-content-area'); // Vùng nội dung chính cuộn được
    let currentUserEmail = null; // Lưu trữ email người dùng trong luồng quên mật khẩu

    // Auth - Resend Code
    const resendCodeLink = document.getElementById('resendCodeLink');
    const resendTimerSpan = document.getElementById('resendTimer');
    let resendInterval;
    const cooldownSeconds = 60;

    // --- Chức năng Điều hướng Trang ---

    /**
     * Hiển thị trang được chỉ định và ẩn các trang khác.
     * Cập nhật class body để thay đổi layout và tiêu đề trang.
     * @param {string} pageId - ID của div trang cần hiển thị (ví dụ: 'page-login').
     */
    function showPage(pageId) {
        console.log(`Điều hướng đến trang: ${pageId}`);
        // 1. Ẩn tất cả các trang trước
        pageContents.forEach(page => page.classList.add('hidden'));

        // 2. Tìm và hiển thị trang mục tiêu
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.remove('hidden');
            let pageTitle = 'Ghibli HRM'; // Tiêu đề mặc định

            // 3. Cập nhật class cho thẻ body và tiêu đề trang
            if (targetPage.classList.contains('auth-page')) {
                body.classList.add('auth-mode');
                body.classList.remove('app-mode');
                let titlePart = pageId.replace('page-', '').replace(/-/g, ' ');
                titlePart = titlePart.charAt(0).toUpperCase() + titlePart.slice(1);
                pageTitle = `Ghibli HRM - ${titlePart}`;
                stopResendCooldown(); // Dừng bộ đếm nếu chuyển về trang auth khác verify
            } else if (targetPage.classList.contains('app-page')) {
                body.classList.remove('auth-mode');
                body.classList.add('app-mode');
                handleSidebarState(); // Đảm bảo trạng thái sidebar đúng
                pageTitle = `Ghibli HRM - ${targetPage.dataset.title || 'Bảng điều khiển'}`;
                setActiveSidebarItem(pageId); // Cập nhật trạng thái active cho sidebar
            }
            document.title = pageTitle;

            // 4. Ẩn các thông báo lỗi/thành công còn sót lại trên trang mới (trừ login khi có thông báo từ reset)
            if (pageId !== 'page-login' || !document.getElementById('loginSuccessMessage')?.offsetParent) {
                 hideAllMessages(targetPage); // Chỉ ẩn message trong trang mới
            }

             // Reset trạng thái trang đánh giá nếu chuyển khỏi nó
            if (currentPageId !== 'page-evaluation' && pageId !== 'page-evaluation') {
                resetEvaluationPage();
            }
            currentPageId = pageId; // Lưu pageId hiện tại

        } else {
            console.error(`Không tìm thấy trang với ID: "${pageId}". Chuyển về trang đăng nhập.`);
            showPage('page-login');
        }

        // 5. Cuộn lên đầu nội dung trang mới
        if (mainContentArea && body.classList.contains('app-mode')) {
            mainContentArea.scrollTop = 0; // Cuộn vùng nội dung chính trong app
        } else if (body.classList.contains('auth-mode')) {
            window.scrollTo(0, 0); // Cuộn cửa sổ cho các trang auth
        }
    }
    let currentPageId = null; // Biến lưu trang hiện tại để xử lý reset

    // --- Xử lý hiển thị Thông báo ---

    /**
     * Hiển thị thông báo trên một trang cụ thể.
     * @param {string} pagePrefix - Tiền tố ID của trang (ví dụ: 'login', 'forgot', 'evalSetup', 'selfEval', 'reviewEval').
     * @param {'error' | 'success' | 'warning' | 'info'} type - Loại thông báo.
     * @param {string} text - Nội dung thông báo.
     * @param {HTMLElement} [container=document] - Container chứa thông báo (mặc định là document).
     */
    function showMessage(pagePrefix, type, text, container = document) {
        hideMessages(pagePrefix, container); // Ẩn thông báo cũ của trang/container này trước
        const messageDivId = `${pagePrefix}${type.charAt(0).toUpperCase() + type.slice(1)}Message`;
        const textSpanId = `${pagePrefix}${type.charAt(0).toUpperCase() + type.slice(1)}Text`; // Optional text span ID

        const messageDiv = container.querySelector(`#${messageDivId}`);
        const textSpan = container.querySelector(`#${textSpanId}`); // Try finding specific span first

        if (messageDiv) {
            // If specific text span exists, use it. Otherwise, find first span or set textContent directly.
            if (textSpan) {
                textSpan.textContent = text;
            } else {
                const genericSpan = messageDiv.querySelector('span');
                if (genericSpan) {
                    genericSpan.textContent = text;
                } else {
                    // Fallback if no span inside message div
                     messageDiv.textContent = text;
                     // Re-add icon if needed
                     // const icon = messageDiv.querySelector('i');
                     // if (icon) messageDiv.prepend(icon, ' ');
                }
            }
            messageDiv.style.display = 'flex'; // Use flex for alignment with icon
             messageDiv.classList.remove('hidden'); // Ensure hidden class is removed
            console.log(`Hiển thị thông báo ${type} (${pagePrefix}): ${text}`);
        } else {
            console.warn(`Không tìm thấy phần tử thông báo cho tiền tố: ${pagePrefix} (ID: ${messageDivId}) trong container`, container);
        }
    }


    /**
     * Ẩn các thông báo (error, success, warning, info) cho một tiền tố cụ thể trong container.
     * @param {string} pagePrefix - Tiền tố ID.
     * @param {HTMLElement} [container=document] - Container chứa thông báo.
     */
    function hideMessages(pagePrefix, container = document) {
        const types = ['Error', 'Success', 'Warning', 'Info'];
        types.forEach(type => {
            const messageDiv = container.querySelector(`#${pagePrefix}${type}Message`);
            if (messageDiv) {
                 messageDiv.style.display = 'none';
                 messageDiv.classList.add('hidden'); // Add hidden class as well
            }
        });
    }

    /** Ẩn tất cả các thông báo trên một trang hoặc toàn bộ document. */
    function hideAllMessages(pageElement = document) {
        pageElement.querySelectorAll('.message').forEach(msg => {
             msg.style.display = 'none';
             msg.classList.add('hidden');
        });
    }


    // --- Cập nhật Nội dung Động ---
    function updateDynamicUsernames(name) {
        document.querySelectorAll('.dynamic-username').forEach(el => el.textContent = name);
        const userDisplay = document.getElementById('userDisplayName');
        if (userDisplay) userDisplay.textContent = name;
    }

    // --- Chức năng Sidebar ---
    function handleSidebarState() {
        if (sidebar) {
            const isCollapsed = localStorage.getItem('ghibliHrmSidebarCollapsed') === 'true';
            sidebar.classList.toggle('collapsed', isCollapsed);
            // console.log('Trạng thái sidebar ban đầu. Thu gọn:', isCollapsed);
        }
    }

    function setActiveSidebarItem(pageId) {
        document.querySelectorAll('.sidebar-nav li').forEach(li => li.classList.remove('active'));
        const activeLink = document.querySelector(`.sidebar-nav a[data-page="${pageId}"]`);
        if (activeLink) {
            activeLink.closest('li').classList.add('active');
        }
    }

    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            const isCollapsed = sidebar.classList.toggle('collapsed');
            localStorage.setItem('ghibliHrmSidebarCollapsed', isCollapsed);
            console.log('Sidebar đã được bật/tắt. Trạng thái thu gọn:', isCollapsed);
        });
        handleSidebarState();
    }

    document.querySelectorAll('.sidebar-nav a[data-page]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetPageId = this.dataset.page;
            if (targetPageId) {
                showPage(targetPageId);
            } else {
                console.warn('Link sidebar thiếu data-page.');
            }
        });
    });

    // Event delegation for dashboard cards linking to pages
    document.querySelector('#page-dashboard')?.addEventListener('click', (event) => {
        const cardLink = event.target.closest('a.feature-card[data-page]');
        if (cardLink) {
            event.preventDefault();
            const targetPageId = cardLink.dataset.page;
            if (targetPageId) {
                showPage(targetPageId);
            }
        }
    });


    // --- Menu Người dùng và Đăng xuất ---
    if (userMenu && userDropdown) {
        userMenu.addEventListener('click', (e) => {
            // Chỉ toggle khi click vào vùng user-menu nhưng không phải nút logout
            if (!e.target.closest('#logoutButton')) {
                const isDisplayed = userDropdown.style.display === 'block';
                userDropdown.style.display = isDisplayed ? 'none' : 'block';
                userMenu.classList.toggle('open', !isDisplayed);
            }
        });

        document.addEventListener('click', (e) => {
            if (!userMenu.contains(e.target) && userDropdown.style.display === 'block') {
                userDropdown.style.display = 'none';
                userMenu.classList.remove('open');
            }
        });

        const logoutButton = document.getElementById('logoutButton');
        if (logoutButton) {
            logoutButton.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Người dùng thực hiện đăng xuất.');
                // TODO: Thêm logic đăng xuất thực tế (clear token/session, gọi API logout)
                showMessage('login', 'success', 'Bạn đã đăng xuất thành công.');
                showPage('page-login');
                updateDynamicUsernames('Nhân Viên'); // Reset tên
                 userDropdown.style.display = 'none'; // Đóng dropdown
                 userMenu.classList.remove('open');
            });
        }
    }

    // --- Xử lý các Nút và Hành động trong Nội dung Chính ---
    if (mainContentArea) {
        mainContentArea.addEventListener('click', (event) => {
             const button = event.target.closest('button'); // Tìm nút gần nhất được click
             if (!button) return; // Nếu không phải click vào nút thì thôi

            if (button.classList.contains('quick-add-button')) {
                event.preventDefault();
                alert('Chức năng "Thêm nhanh" chưa được cài đặt!');
                console.log('Đã click nút "Thêm nhanh".');
            } else if (button.classList.contains('delete-button')) {
                // Check if it's deleting an evaluation period
                if (button.classList.contains('delete-period-btn')) {
                    handleDeleteEvaluationPeriodClick(event);
                } else {
                    // Handle generic delete (like personnel)
                    handleDeleteClick(event);
                }
            }
            // Add other generic button handlers here if needed
            // else if (button.classList.contains('some-other-action')) { ... }
        });
        // console.log('Đã gắn listener cho các nút trong main-content-area.');
    }

    /** Xử lý click nút xóa chung. */
    function handleDeleteClick(e) {
        e.preventDefault();
        const button = e.target.closest('.delete-button');
        const row = button.closest('tr');
        const itemContainer = !row ? button.closest('[data-id]') : null;
        let itemName = 'đối tượng này';
        let itemId = null;

        if (row) {
            itemId = row.dataset.id;
            if (row.cells.length > 2 && row.cells[2]) {
                itemName = row.cells[2].textContent?.trim() || itemName;
            }
            console.log(`Chuẩn bị xóa ID (từ dòng): ${itemId}, Tên: ${itemName}`);
        } else if (itemContainer) {
            itemId = itemContainer.dataset.id;
            const nameElement = itemContainer.querySelector('.item-name, h3, .feature-info h3');
            if (nameElement) itemName = nameElement.textContent?.trim() || itemName;
            console.log(`Chuẩn bị xóa ID (từ container): ${itemId}, Tên: ${itemName}`);
        } else {
            console.warn('Không tìm thấy dòng table hoặc container có data-id cho mục tiêu xóa.');
            itemId = 'Không xác định'; // Gán giá trị để hiển thị
        }

        if (confirm(`Bạn có chắc chắn muốn xóa "${itemName}" (ID: ${itemId})? Hành động này không thể hoàn tác.`)) {
            console.log(`Người dùng xác nhận xóa: ${itemName}`);
            alert(`Chức năng "Xóa" "${itemName}" (ID: ${itemId}) chưa được cài đặt!`);
            // --- Logic Xóa Thực Tế (Placeholder) ---
            // if (itemId && itemId !== 'Không xác định') { simulateApiDelete(itemId, button, row || itemContainer); }
        } else {
            console.log(`Người dùng hủy xóa: ${itemName}`);
        }
    }

    // --- Xử lý Form Xác thực (Auth Forms) ---

    // Form Đăng nhập
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (event) => {
            event.preventDefault();
            hideMessages('login'); // Chỉ ẩn msg của login form
            const employeeIdInput = document.getElementById('employeeId');
            const passwordInput = document.getElementById('password');
            const employeeId = employeeIdInput.value.trim();
            const password = passwordInput.value;

            if (!employeeId || !password) {
                 showMessage('login', 'error', 'Vui lòng nhập Mã nhân viên và Mật khẩu.');
                 return;
            }

            console.log(`Đang mô phỏng đăng nhập cho Mã NV: ${employeeId}`);
            const submitButton = loginForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang đăng nhập...';

            // --- Mô phỏng API đăng nhập ---
            setTimeout(() => {
                // Giả sử đăng nhập thành công với bất kỳ thông tin nào (cho demo)
                console.log('Mô phỏng đăng nhập thành công.');
                // TODO: Lấy tên người dùng thật từ API response
                updateDynamicUsernames(employeeId); // Tạm thời hiển thị Mã NV
                showPage('page-dashboard');
                loginForm.reset(); // Xóa form sau khi thành công
                // Reset button state (nút sẽ không thấy nữa nhưng nên làm cho đúng)
                submitButton.disabled = false;
                submitButton.innerHTML = '<i class="fas fa-leaf"></i> Đăng nhập';

                // Kịch bản thất bại (ví dụ: comment out để dùng kịch bản thành công)
                /*
                 showMessage('login', 'error', 'Mã nhân viên hoặc mật khẩu không đúng.');
                 submitButton.disabled = false;
                 submitButton.innerHTML = '<i class="fas fa-leaf"></i> Đăng nhập';
                 passwordInput.value = ''; // Chỉ xóa pass
                 */
            }, 1000);
        });
    }

    // Link "Quên mật khẩu?"
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            showPage('page-forgot-password');
        });
    }

    // Các link "Quay lại Đăng nhập"
    document.querySelectorAll('.back-to-login-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showPage('page-login');
        });
    });

     // Form Quên Mật khẩu (Gửi email)
     const forgotPasswordForm = document.getElementById('forgotPasswordForm');
     if (forgotPasswordForm) {
         forgotPasswordForm.addEventListener('submit', (event) => {
             event.preventDefault();
             hideMessages('forgot');
             const emailInput = document.getElementById('forgotEmail');
             const email = emailInput.value.trim();

             if (!email || !/\S+@\S+\.\S+/.test(email)) {
                 showMessage('forgot', 'error', 'Vui lòng nhập địa chỉ email hợp lệ.');
                 return;
             }

             currentUserEmail = email; // Lưu email
             console.log(`Mô phỏng gửi mã đến: ${currentUserEmail}`);
             const sendButton = document.getElementById('sendCodeButton');
             sendButton.disabled = true;
             sendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang gửi...';

             // --- Mô phỏng API gửi mã ---
             setTimeout(() => {
                  console.log('Mô phỏng gửi mã thành công.');
                  const displayEmailSpan = document.getElementById('displayUserEmail');
                  if(displayEmailSpan) displayEmailSpan.textContent = currentUserEmail; // Cập nhật email trên trang verify
                  showPage('page-verify-code');
                  // Reset button state on forgot pw page after successful navigation
                  sendButton.disabled = false;
                  sendButton.innerHTML = '<i class="fas fa-paper-plane"></i> Gửi mã xác nhận';
                  forgotPasswordForm.reset(); // Reset form
                  startResendCooldown(); // Bắt đầu đếm ngược ở trang verify
             }, 1000);
         });
     }

    // Form Xác nhận Mã
    const verifyCodeForm = document.getElementById('verifyCodeForm');
    if (verifyCodeForm) {
        verifyCodeForm.addEventListener('submit', (event) => {
            event.preventDefault();
            hideMessages('verify');
            const verificationCodeInput = document.getElementById('verificationCode');
            const code = verificationCodeInput.value.trim();

            if (!code || code.length !== 6 || !/^\d+$/.test(code)) {
                showMessage('verify', 'error', 'Vui lòng nhập mã xác nhận hợp lệ (6 chữ số).');
                return;
            }

            const verifyCodeButton = document.getElementById('verifyCodeButton');
            verifyCodeButton.disabled = true;
            verifyCodeButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xác nhận...';

            // --- Mô phỏng API xác nhận mã ---
            setTimeout(() => {
                if (code === '123456') { // Mã đúng (demo)
                    console.log('Mã xác nhận đúng.');
                    // Không hiển thị success ở đây, chuyển trang ngay
                    // showMessage('verify', 'success', 'Xác nhận thành công! Đang chuyển trang...');
                    stopResendCooldown(); // Dừng bộ đếm khi thành công
                    showPage('page-reset-password'); // Chuyển đến trang đặt lại MK
                    // Reset form và button trên trang verify (sau khi chuyển trang)
                    verificationCodeInput.value = '';
                    verifyCodeButton.disabled = false;
                    verifyCodeButton.innerHTML = '<i class="fas fa-check-circle"></i> Xác nhận mã';

                } else { // Mã sai
                    console.log('Mã xác nhận sai.');
                    showMessage('verify', 'error', 'Mã xác nhận không đúng. Vui lòng thử lại.');
                    verifyCodeButton.disabled = false;
                    verifyCodeButton.innerHTML = '<i class="fas fa-check-circle"></i> Xác nhận mã';
                    verificationCodeInput.select(); // Focus lại input mã
                }
            }, 1000);
        });
    }

    // Logic Gửi lại mã
    if (resendCodeLink && resendTimerSpan) {
        resendCodeLink.addEventListener('click', (event) => {
            event.preventDefault();
            if (resendCodeLink.classList.contains('disabled')) return;

            hideMessages('verify'); // Chỉ ẩn msg của trang verify
            startResendCooldown();
            showMessage('verify', 'info', 'Đang gửi lại mã xác nhận...'); // Dùng info

            // --- Mô phỏng API gửi lại mã ---
            console.log(`Mô phỏng gửi lại mã đến: ${currentUserEmail || 'email đã lưu'}`);
            setTimeout(() => {
                 showMessage('verify', 'success', 'Đã gửi lại mã thành công. Vui lòng kiểm tra email.');
                 console.log('Mô phỏng gửi lại mã thành công.');
                 document.getElementById('verificationCode')?.focus(); // Focus vào input mã
            }, 1000);
        });
    }

     window.addEventListener('beforeunload', () => {
         clearInterval(resendInterval);
     });

     function startResendCooldown() {
          if (!resendCodeLink || !resendTimerSpan) return;
         clearInterval(resendInterval);
         resendCodeLink.classList.add('disabled');
         resendCodeLink.style.display = 'none';
         resendTimerSpan.parentElement.style.display = 'block'; // Hiển thị cả dòng "Không nhận được mã?"
         resendTimerSpan.style.display = 'inline';
         let secondsLeft = cooldownSeconds;
         resendTimerSpan.textContent = `Gửi lại sau ${secondsLeft}s`;
         resendInterval = setInterval(() => {
             secondsLeft--;
             resendTimerSpan.textContent = `Gửi lại sau ${secondsLeft}s`;
             if (secondsLeft <= 0) stopResendCooldown();
         }, 1000);
     }

     function stopResendCooldown() {
         if (!resendCodeLink || !resendTimerSpan) return;
         clearInterval(resendInterval);
         resendCodeLink.classList.remove('disabled');
         resendCodeLink.style.display = 'inline';
         resendTimerSpan.style.display = 'none';
         resendTimerSpan.parentElement.style.display = 'block'; // Đảm bảo dòng text vẫn hiện
     }

     // Form Đặt lại Mật khẩu
     const resetPasswordForm = document.getElementById('resetPasswordForm');
     if (resetPasswordForm) {
         resetPasswordForm.addEventListener('submit', (event) => {
             event.preventDefault();
             hideMessages('reset');
             const newPasswordInput = document.getElementById('newPassword');
             const confirmPasswordInput = document.getElementById('confirmPassword');
             const newPassword = newPasswordInput.value;
             const confirmPassword = confirmPasswordInput.value;

             if (!newPassword || !confirmPassword) {
                 showMessage('reset', 'error', 'Vui lòng nhập cả hai trường mật khẩu.'); return;
             }
             if (newPassword.length < 6) { // Ví dụ kiểm tra độ dài
                 showMessage('reset', 'error', 'Mật khẩu mới phải có ít nhất 6 ký tự.'); return;
             }
             if (newPassword !== confirmPassword) {
                 showMessage('reset', 'error', 'Mật khẩu xác nhận không khớp.');
                 confirmPasswordInput.focus(); // Focus vào ô xác nhận
                 return;
             }

             const resetButton = document.getElementById('resetPasswordButton');
             resetButton.disabled = true;
             resetButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang cập nhật...';

             // --- Mô phỏng API đặt lại mật khẩu ---
             console.log('Mô phỏng đặt lại mật khẩu...');
             setTimeout(() => {
                  console.log('Mô phỏng đặt lại mật khẩu thành công.');
                  // Hiển thị thông báo thành công TRÊN TRANG ĐĂNG NHẬP
                  showMessage('login', 'success', 'Mật khẩu đã được cập nhật thành công. Vui lòng đăng nhập bằng mật khẩu mới.');
                  showPage('page-login'); // Chuyển về trang đăng nhập
                  // Reset form và button trên trang reset (sau khi chuyển)
                  resetPasswordForm.reset();
                  resetButton.disabled = false;
                  resetButton.innerHTML = '<i class="fas fa-save"></i> Đặt lại Mật khẩu';
             }, 1500);
         });
     }

    // ====================================================
    // ========== LOGIC TRANG QUẢN LÝ ĐÁNH GIÁ ==========
    // ====================================================

    const evaluationPage = document.getElementById('page-evaluation');
    if (evaluationPage) {
        // Mode Switching Elements
        const setupModeButton = document.getElementById('switchToSetupMode');
        const selfEvalModeButton = document.getElementById('switchToSelfEvalMode');
        const reviewModeButton = document.getElementById('switchToReviewMode');
        const modeButtons = [setupModeButton, selfEvalModeButton, reviewModeButton];

        const setupModeSection = document.getElementById('evaluation-setup-mode');
        const selfEvalModeSection = document.getElementById('evaluation-self-mode');
        const reviewModeSection = document.getElementById('evaluation-review-mode');
        const contentSections = [setupModeSection, selfEvalModeSection, reviewModeSection];

        // --- Setup Mode Elements ---
        const existingPeriodsSection = document.getElementById('existing-periods-section');
        const setupFormSection = document.getElementById('evaluation-setup-form-section');
        const showSetupFormButton = document.getElementById('showSetupFormButton');
        const cancelSetupButton = document.getElementById('cancelSetupButton');
        const evaluationSetupForm = document.getElementById('evaluationSetupForm');
        const periodPositionSelect = document.getElementById('periodPosition');
        const employeeListDiv = document.getElementById('evaluation-employee-list');
        const employeeListPlaceholder = document.getElementById('employeeListPlaceholder');
        const selectAllEmployeesCheckbox = document.getElementById('selectAllEmployees');
        const employeesSelectedFlag = document.getElementById('employeesSelectedFlag');
        const employeeSelectionError = document.getElementById('employeeSelectionError');
        const periodsTableBody = document.getElementById('evaluationPeriodsTableBody');
        const savePeriodButton = document.getElementById('saveEvaluationPeriodButton');

        // --- Self-Evaluation Mode Elements ---
        const selfEvaluationForm = document.getElementById('selfEvaluationForm');
        const selfEvalPeriodSelect = document.getElementById('selfEvalPeriodSelect');
        const selfEvalCriteriaSection = document.getElementById('selfEvalCriteriaSection');
        const saveSelfEvaluationButton = document.getElementById('saveSelfEvaluationButton');
        const selfEvalLoadingMessage = document.getElementById('selfEvalLoadingMessage');
        const selfEvalAlreadySubmitted = document.getElementById('selfEvalAlreadySubmitted');

        // --- Review Mode Elements ---
        const reviewPeriodSelect = document.getElementById('reviewPeriodSelect');
        const managerReviewDisplayArea = document.getElementById('managerReviewDisplayArea');
        const reviewLoadingMessage = document.getElementById('reviewLoadingMessage');
        const reviewUnavailableMessage = document.getElementById('reviewUnavailableMessage');
        const reviewTicketId = document.getElementById('reviewTicketId');
        const managerCommentsDisplay = document.getElementById('managerCommentsDisplay');
        // Score elements (example)
        const scoreProductKnowledge = document.getElementById('score_product_knowledge');
        // ... add other score elements ...
        const scoreTotal = document.getElementById('score_total');
        // Feedback elements
        const toggleFeedbackFormButton = document.getElementById('toggleFeedbackFormButton');
        const feedbackForm = document.getElementById('feedbackForm');
        const cancelFeedbackButton = document.getElementById('cancelFeedbackButton');
        const submitFeedbackButton = document.getElementById('submitFeedbackButton');
        const feedbackSuccessMessage = document.getElementById('feedbackSuccessMessage');


        // --- Evaluation: Event Listeners ---

        // Mode Switching
        modeButtons.forEach(button => {
            if(button) {
                button.addEventListener('click', handleModeSwitch);
            }
        });

        // Setup Mode: Show/Hide Form
        if (showSetupFormButton) {
            showSetupFormButton.addEventListener('click', () => {
                existingPeriodsSection.classList.add('hidden');
                setupFormSection.classList.remove('hidden');
                hideMessages('evalSetup', setupFormSection); // Hide messages on form show
                evaluationSetupForm?.reset(); // Reset form when showing
                clearEmployeeList(); // Clear employee list
            });
        }
        if (cancelSetupButton) {
            cancelSetupButton.addEventListener('click', () => {
                setupFormSection.classList.add('hidden');
                existingPeriodsSection.classList.remove('hidden');
                hideMessages('evalSetupList', existingPeriodsSection); // Hide messages on list show
            });
        }

        // Setup Mode: Load Employees on Department Change
        if (periodPositionSelect) {
            periodPositionSelect.addEventListener('change', handleDepartmentChange);
        }

        // Setup Mode: Select All Employees
        if (selectAllEmployeesCheckbox) {
            selectAllEmployeesCheckbox.addEventListener('change', handleSelectAllEmployees);
        }

        // Setup Mode: Handle individual employee checkbox changes (Event Delegation)
        if (employeeListDiv) {
            employeeListDiv.addEventListener('change', handleEmployeeCheckboxChange);
        }

        // Setup Mode: Form Submission
        if (evaluationSetupForm) {
            evaluationSetupForm.addEventListener('submit', handleEvaluationSetupSubmit);
        }

        // Self-Eval Mode: Period Selection Change
        if (selfEvalPeriodSelect) {
            selfEvalPeriodSelect.addEventListener('change', handleSelfEvalPeriodChange);
        }

         // Self-Eval Mode: Form Submission
        if (selfEvaluationForm) {
            selfEvaluationForm.addEventListener('submit', handleSelfEvaluationSubmit);
        }

        // Review Mode: Period Selection Change
        if (reviewPeriodSelect) {
            reviewPeriodSelect.addEventListener('change', handleReviewPeriodChange);
        }

        // Review Mode: Toggle Feedback Form
        if (toggleFeedbackFormButton) {
            toggleFeedbackFormButton.addEventListener('click', () => {
                feedbackForm.classList.toggle('hidden');
                // Hide success message if shown previously
                if (!feedbackForm.classList.contains('hidden')) {
                     feedbackSuccessMessage.classList.add('hidden');
                     feedbackForm.reset(); // Reset form when shown
                }
            });
        }

        // Review Mode: Cancel Feedback
        if (cancelFeedbackButton) {
             cancelFeedbackButton.addEventListener('click', () => {
                feedbackForm.classList.add('hidden');
                hideMessages('feedback', feedbackForm.closest('.card-body')); // Hide potential errors
            });
        }

        // Review Mode: Submit Feedback
        if (feedbackForm) {
             feedbackForm.addEventListener('submit', handleFeedbackSubmit);
        }


        // --- Evaluation: Handler Functions ---

        function handleModeSwitch(event) {
            const clickedButton = event.currentTarget;
            const targetMode = clickedButton.id.replace('switchTo', '').replace('Mode', '').toLowerCase(); // 'setup', 'selfeval', 'review'

            // Hide all content sections
            contentSections.forEach(section => section?.classList.add('hidden'));

            // Show target section
            const targetSection = document.getElementById(`evaluation-${targetMode}-mode`);
            if (targetSection) {
                targetSection.classList.remove('hidden');
                 hideAllMessages(targetSection); // Hide messages in the newly shown section
                 resetModeSection(targetMode); // Reset specific mode section UI
            }

            // Update button styles
            modeButtons.forEach(btn => btn?.classList.remove('active-mode'));
            clickedButton.classList.add('active-mode');
        }

        // Reset UI elements within a specific mode when switching TO it
        function resetModeSection(mode) {
            switch (mode) {
                case 'setup':
                    // Show list, hide form by default
                    existingPeriodsSection?.classList.remove('hidden');
                    setupFormSection?.classList.add('hidden');
                    evaluationSetupForm?.reset();
                    clearEmployeeList();
                    break;
                case 'selfeval':
                    selfEvaluationForm?.reset();
                    selfEvalCriteriaSection?.classList.add('hidden');
                    selfEvalLoadingMessage?.classList.remove('hidden'); // Show initial message
                    selfEvalAlreadySubmitted?.classList.add('hidden');
                    saveSelfEvaluationButton?.setAttribute('disabled', true);
                    break;
                case 'review':
                    reviewPeriodSelect.value = ""; // Reset dropdown
                    managerReviewDisplayArea?.classList.add('hidden');
                    reviewLoadingMessage?.classList.remove('hidden'); // Show initial message
                    reviewUnavailableMessage?.classList.add('hidden');
                    feedbackForm?.classList.add('hidden');
                    feedbackSuccessMessage?.classList.add('hidden');
                    break;
            }
        }
        // Function to reset the entire Evaluation page state (when navigating away)
        function resetEvaluationPage() {
             console.log('Resetting Evaluation Page State');
             // Reset to default mode (Setup)
             setupModeButton?.classList.add('active-mode');
             selfEvalModeButton?.classList.remove('active-mode');
             reviewModeButton?.classList.remove('active-mode');
             setupModeSection?.classList.remove('hidden');
             selfEvalModeSection?.classList.add('hidden');
             reviewModeSection?.classList.add('hidden');
              // Reset UI within each mode
             resetModeSection('setup');
             resetModeSection('selfeval');
             resetModeSection('review');
             // Hide all messages globally within the page
             hideAllMessages(evaluationPage);
        }


        function handleDepartmentChange() {
            const selectedDepartment = periodPositionSelect.value;
            console.log('Department changed:', selectedDepartment);
            if (!selectedDepartment) {
                clearEmployeeList();
                return;
            }

            employeeListPlaceholder.textContent = 'Đang tải danh sách nhân viên...';
            employeeListPlaceholder.style.display = 'block';
            employeeListDiv.innerHTML = ''; // Clear previous list
             selectAllEmployeesCheckbox.checked = false;
             employeesSelectedFlag.value = ""; // Reset flag

            // --- Simulate fetching employees ---
            setTimeout(() => {
                if (selectedDepartment === 'none') { // Example: No employees in this dept
                     employeeListPlaceholder.textContent = 'Không tìm thấy nhân viên nào trong phòng ban này.';
                     employeeListPlaceholder.style.display = 'block';
                     employeeListDiv.innerHTML = '';
                     employeesSelectedFlag.value = ""; // Still no employees
                } else {
                     employeeListPlaceholder.style.display = 'none';
                    // Sample data (replace with real fetch)
                    const employees = [
                        { id: 'NV001', name: 'Totoro Mập Ú (R&D)', dept: 'rnd' },
                        { id: 'NV004', name: 'Ponyo (R&D)', dept: 'rnd' },
                        { id: 'NV002', name: 'Mèo Jiji (CSKH)', dept: 'cus' },
                        { id: 'NV003', name: 'Vô Diện (CSKH)', dept: 'cus' },
                        { id: 'NV005', name: 'Kiki (Sales)', dept: 'sal'},
                        { id: 'NV006', name: 'Howl (Sales)', dept: 'sal'}
                    ];

                    // Filter based on selection (or show all if 'all')
                    const filteredEmployees = selectedDepartment === 'all'
                        ? employees
                        : employees.filter(emp => emp.dept === selectedDepartment);

                    if (filteredEmployees.length > 0) {
                        filteredEmployees.forEach(emp => {
                             const div = document.createElement('div');
                             div.className = 'form-group'; // Use form-group for styling consistency
                             div.style.marginBottom = '10px';
                             div.innerHTML = `
                                <label style="display: flex; align-items: center; font-weight: normal; cursor: pointer;">
                                    <input type="checkbox" name="selectedEmployees[]" value="${emp.id}" class="employee-checkbox" style="width: auto; height:auto; margin-right: 10px; accent-color: var(--ghibli-green-medium);">
                                    <span class="employee-name">${emp.name}</span>
                                </label>
                            `;
                            employeeListDiv.appendChild(div);
                        });
                         employeesSelectedFlag.value = "loaded"; // Mark as loaded but not necessarily selected yet
                    } else {
                         employeeListPlaceholder.textContent = 'Không tìm thấy nhân viên nào phù hợp.';
                         employeeListPlaceholder.style.display = 'block';
                         employeesSelectedFlag.value = ""; // No employees to select
                    }
                     // Check initial selection state after loading
                     checkEmployeeSelection();
                }
            }, 500); // Simulate network delay
        }

        function clearEmployeeList() {
             if(employeeListDiv) employeeListDiv.innerHTML = '';
             if(employeeListPlaceholder) {
                 employeeListPlaceholder.textContent = 'Vui lòng chọn \'Phòng ban\' ở trên để tải danh sách nhân viên.';
                 employeeListPlaceholder.style.display = 'block';
             }
            if(selectAllEmployeesCheckbox) selectAllEmployeesCheckbox.checked = false;
            if(employeesSelectedFlag) employeesSelectedFlag.value = ""; // Reset flag
            hideMessages('evalSetup', evaluationSetupForm); // Hide selection error if department is cleared
        }

        function handleSelectAllEmployees() {
            const isChecked = selectAllEmployeesCheckbox.checked;
            employeeListDiv.querySelectorAll('.employee-checkbox').forEach(checkbox => {
                checkbox.checked = isChecked;
            });
             checkEmployeeSelection(); // Update selection status
        }

        function handleEmployeeCheckboxChange(event) {
             if (event.target.classList.contains('employee-checkbox')) {
                 checkEmployeeSelection(); // Update selection status
                 // Uncheck "Select All" if any individual box is unchecked
                 if (!event.target.checked) {
                     selectAllEmployeesCheckbox.checked = false;
                 } else {
                     // Check if all are checked now
                     const allCheckboxes = employeeListDiv.querySelectorAll('.employee-checkbox');
                     const allChecked = Array.from(allCheckboxes).every(cb => cb.checked);
                     selectAllEmployeesCheckbox.checked = allChecked;
                 }
             }
        }

        // Checks if at least one employee is selected and updates the flag/error message
        function checkEmployeeSelection() {
             const selectedCheckboxes = employeeListDiv.querySelectorAll('.employee-checkbox:checked');
             if (selectedCheckboxes.length > 0) {
                 employeesSelectedFlag.value = "selected"; // Mark as selected
                 employeeSelectionError.style.display = 'none'; // Hide error
             } else {
                 // Only mark as not selected if employees were actually loaded
                 if (employeesSelectedFlag.value === "loaded" || employeesSelectedFlag.value === "selected") {
                     employeesSelectedFlag.value = "loaded"; // Still loaded, but none selected
                 }
                  // Do not show error immediately, only on submit validation
             }
             console.log("Employee selection flag:", employeesSelectedFlag.value);
        }

        function handleEvaluationSetupSubmit(event) {
            event.preventDefault();
            hideMessages('evalSetup', setupFormSection); // Hide previous messages
            console.log('Submitting Evaluation Setup Form...');

            // Basic Form Validation (add more as needed)
            const periodName = document.getElementById('periodName').value.trim();
            const department = periodPositionSelect.value;
            const targetMonth = document.getElementById('periodTargetMonth').value;
            const deadline = document.getElementById('periodDeadline').value;
            const criteria = document.getElementById('periodCriteria').value.trim();

            if (!periodName || !department || !targetMonth || !deadline || !criteria) {
                showMessage('evalSetup', 'error', 'Vui lòng điền đầy đủ các trường bắt buộc (*).', setupFormSection);
                return;
            }

             // Employee Selection Validation
            const anyEmployeeSelected = employeesSelectedFlag.value === "selected";
             if (!anyEmployeeSelected) {
                 showMessage('evalSetup', 'error', 'Vui lòng chọn ít nhất một nhân viên để đánh giá.', setupFormSection);
                  employeeSelectionError.style.display = 'flex'; // Show the specific error div too
                 return;
             } else {
                 employeeSelectionError.style.display = 'none'; // Hide if previously shown
             }

            savePeriodButton.disabled = true;
            savePeriodButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang lưu...';

            const formData = new FormData(evaluationSetupForm);
            const data = Object.fromEntries(formData.entries());
            // Get selected employees correctly
            data.selectedEmployees = Array.from(formData.getAll('selectedEmployees[]'));
             console.log('Setup Data to Send:', data);


            // --- Simulate API Call ---
            setTimeout(() => {
                console.log('Mô phỏng lưu Kỳ đánh giá thành công.');
                showMessage('evalSetupList', 'success', `Đã thiết lập thành công kỳ đánh giá "${periodName}".`, existingPeriodsSection); // Show success on the list view

                // Add the new period to the table (simple example)
                const newRow = periodsTableBody.insertRow(0); // Add to top
                newRow.dataset.id = `P${Date.now()}`; // Generate a dummy ID
                newRow.innerHTML = `
                    <td>${periodName}</td>
                    <td>${periodPositionSelect.options[periodPositionSelect.selectedIndex].text}</td>
                    <td>${deadline}</td>
                    <td><span class="status status-pending">Bản nháp</span></td>
                    <td>
                        <button class="action-btn btn-edit view-details-btn" title="Xem Chi tiết"><i class="fas fa-eye"></i></button>
                        <button class="action-btn btn-edit edit-period-btn" title="Sửa Kỳ Đánh giá"><i class="fas fa-pencil-alt"></i></button>
                        <button class="action-btn btn-danger delete-button delete-period-btn" title="Xóa Kỳ Đánh giá"><i class="fas fa-trash-alt"></i></button>
                    </td>
                `;

                // Switch back to the list view
                setupFormSection.classList.add('hidden');
                existingPeriodsSection.classList.remove('hidden');
                 evaluationSetupForm.reset(); // Reset form
                 clearEmployeeList(); // Clear employee list


                savePeriodButton.disabled = false;
                savePeriodButton.innerHTML = '<i class="fas fa-save"></i> Lưu Kỳ Đánh giá';

                // TODO: Update pagination if necessary

                 // Simulate error case (comment out success part)
                 /*
                 console.error('Mô phỏng lỗi lưu Kỳ đánh giá.');
                 showMessage('evalSetup', 'error', 'Lưu không thành công. Có lỗi xảy ra.', setupFormSection);
                 savePeriodButton.disabled = false;
                 savePeriodButton.innerHTML = '<i class="fas fa-save"></i> Lưu Kỳ Đánh giá';
                 */

            }, 1500);
        }

        // Handle deleting an evaluation period
        function handleDeleteEvaluationPeriodClick(e) {
            e.preventDefault();
            const button = e.target.closest('.delete-button');
            const row = button.closest('tr');
            const periodId = row?.dataset.id;
            const periodName = row?.cells[0]?.textContent?.trim() || 'kỳ đánh giá này';

            if (!periodId) {
                console.warn('Không tìm thấy ID của kỳ đánh giá để xóa.');
                alert('Lỗi: Không thể xác định kỳ đánh giá cần xóa.');
                return;
            }

            if (confirm(`Bạn có chắc chắn muốn xóa "${periodName}" (ID: ${periodId})? Tất cả dữ liệu đánh giá liên quan cũng sẽ bị xóa vĩnh viễn.`)) {
                console.log(`Người dùng xác nhận xóa kỳ đánh giá: ${periodName} (ID: ${periodId})`);
                alert(`Chức năng "Xóa Kỳ Đánh giá" "${periodName}" (ID: ${periodId}) chưa được cài đặt!`);

                // --- Logic Xóa Thực Tế (Placeholder) ---
                 // button.disabled = true;
                 // fetch(`/api/evaluation-periods/${periodId}`, { method: 'DELETE' })
                 // .then(response => {
                 //     if (response.ok) {
                 //         console.log(`Đã xóa thành công kỳ ${periodId}`);
                 //         row.remove();
                 //         showMessage('evalSetupList', 'success', `Đã xóa thành công kỳ đánh giá "${periodName}".`, existingPeriodsSection);
                 //         // TODO: Update pagination
                 //     } else { throw new Error(`Lỗi server: ${response.status}`); }
                 // })
                 // .catch(error => {
                 //     console.error('Lỗi khi xóa kỳ đánh giá:', error);
                 //     alert('Xóa không thành công. Vui lòng thử lại.');
                 //     showMessage('evalSetupList', 'error', `Xóa kỳ đánh giá "${periodName}" không thành công.`, existingPeriodsSection);
                 //     button.disabled = false;
                 // });
            } else {
                console.log(`Người dùng hủy xóa kỳ đánh giá: ${periodName}`);
            }
        }


        function handleSelfEvalPeriodChange() {
            const selectedPeriodId = selfEvalPeriodSelect.value;
            hideMessages('selfEval', selfEvaluationForm.closest('.card')); // Hide all previous messages
            selfEvalCriteriaSection.classList.add('hidden');
            saveSelfEvaluationButton.setAttribute('disabled', true);
            selfEvalAlreadySubmitted.classList.add('hidden');
            selfEvaluationForm.reset(); // Reset scores/comments
             selfEvalPeriodSelect.value = selectedPeriodId; // Keep period selected


            if (!selectedPeriodId) {
                selfEvalLoadingMessage.classList.remove('hidden');
                selfEvalLoadingMessage.querySelector('span').textContent = 'Vui lòng chọn Kỳ Đánh giá để bắt đầu.';
                return;
            }

            selfEvalLoadingMessage.classList.remove('hidden');
            selfEvalLoadingMessage.querySelector('span').textContent = 'Đang kiểm tra trạng thái...';


            // --- Simulate checking submission status & loading criteria ---
            setTimeout(() => {
                // Demo: Assume P2025Q1 is open and not submitted yet
                // Demo: Assume P2024Q4 was submitted (read-only example - not fully implemented)
                const alreadySubmitted = selectedPeriodId === 'P2024Q4_SUBMITTED'; // Dummy value for demo

                if (alreadySubmitted) {
                    console.log(`Tự đánh giá cho kỳ ${selectedPeriodId} đã được nộp.`);
                    selfEvalLoadingMessage.classList.add('hidden');
                    selfEvalAlreadySubmitted.classList.remove('hidden');
                    // Optionally load read-only scores here if needed
                } else {
                     console.log(`Tải tiêu chí cho kỳ ${selectedPeriodId}.`);
                     selfEvalLoadingMessage.classList.add('hidden');
                     selfEvalCriteriaSection.classList.remove('hidden');
                     saveSelfEvaluationButton.removeAttribute('disabled');
                     // TODO: Populate criteria based on selectedPeriodId if they differ
                }
            }, 700);
        }

         function handleSelfEvaluationSubmit(event) {
             event.preventDefault();
             hideMessages('selfEval', selfEvaluationForm.closest('.card'));
             console.log('Submitting Self Evaluation Form...');

             const selectedPeriodId = selfEvalPeriodSelect.value;
             if (!selectedPeriodId) {
                 showMessage('selfEval', 'error', 'Vui lòng chọn Kỳ Đánh giá trước khi nộp.', selfEvaluationForm.closest('.card'));
                 return;
             }

             // Simple validation: check if at least one score is selected (optional)
             const scoreSelects = selfEvaluationForm.querySelectorAll('.criteria-score-select');
             const anyScoreSelected = Array.from(scoreSelects).some(select => select.value !== "");
             // if (!anyScoreSelected) {
             //     showMessage('selfEval', 'warning', 'Bạn chưa chọn điểm cho bất kỳ tiêu chí nào.', selfEvaluationForm.closest('.card'));
             //     // return; // Might allow submitting with no scores? Depends on requirement.
             // }

             saveSelfEvaluationButton.disabled = true;
             saveSelfEvaluationButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang nộp...';

             const formData = new FormData(selfEvaluationForm);
             const data = Object.fromEntries(formData.entries());
              // Restructure criteria if needed by backend
             // data.criteria = {};
             // scoreSelects.forEach(select => {
             //     if (select.value) { data.criteria[select.name.match(/\[(.*?)\]/)[1]] = select.value; }
             // });
              console.log('Self-Eval Data to Send:', data);

             // --- Simulate API Call ---
             setTimeout(() => {
                 console.log('Mô phỏng Nộp Tự đánh giá thành công.');
                 showMessage('selfEval', 'success', 'Đã nộp bản tự đánh giá thành công.', selfEvaluationForm.closest('.card'));
                 selfEvalCriteriaSection.classList.add('hidden'); // Hide form fields
                 // Keep button disabled and text as "Đang nộp..." or change to "Đã nộp"
                 saveSelfEvaluationButton.innerHTML = '<i class="fas fa-check-circle"></i> Đã nộp';
                 // Don't re-enable the button after successful submission for this period

                 // Simulate error case
                 /*
                 console.error('Mô phỏng lỗi Nộp Tự đánh giá.');
                 showMessage('selfEval', 'error', 'Nộp không thành công. Vui lòng thử lại.', selfEvaluationForm.closest('.card'));
                 saveSelfEvaluationButton.disabled = false;
                 saveSelfEvaluationButton.innerHTML = '<i class="fas fa-paper-plane"></i> Nộp Tự Đánh giá';
                 */
             }, 1500);
         }


        function handleReviewPeriodChange() {
            const selectedPeriodId = reviewPeriodSelect.value;
            hideMessages('reviewEval', reviewModeSection); // Hide previous messages
             hideMessages('feedback', feedbackForm.closest('.card-body')); // Hide feedback messages
            managerReviewDisplayArea.classList.add('hidden');
            feedbackForm.classList.add('hidden'); // Hide feedback form
            feedbackSuccessMessage.classList.add('hidden');
            reviewUnavailableMessage.classList.add('hidden');

            if (!selectedPeriodId) {
                reviewLoadingMessage.classList.remove('hidden');
                reviewLoadingMessage.querySelector('span').textContent = 'Vui lòng chọn Kỳ Đánh giá để xem kết quả.';
                return;
            }

            reviewLoadingMessage.classList.remove('hidden');
            reviewLoadingMessage.querySelector('span').textContent = 'Đang tải dữ liệu đánh giá...';

            // --- Simulate Fetching Manager Review Data ---
            setTimeout(() => {
                // Demo Data (replace with actual API response structure)
                const reviews = {
                    "P2024Q4": { // Assumed closed and reviewed
                        ticketId: "#MGR-EVL-1056",
                        scores: {
                            product_knowledge: 8, business_acumen: 7, management: 9,
                            analysis: 8, project_management: 7, problem_solving: 9,
                            responsibility: 10, attitude: 9
                        },
                        comments: "Nhìn chung đã hoàn thành tốt các mục tiêu đề ra trong quý. Kỹ năng quản lý và tinh thần trách nhiệm rất cao. Cần cải thiện thêm về quản lý dự án phức tạp và am hiểu nghiệp vụ sâu hơn.",
                        feedbackSubmitted: false // Example state
                    },
                    "P2025Q1": null // Assumed open or not reviewed yet
                };

                const reviewData = reviews[selectedPeriodId];
                 reviewLoadingMessage.classList.add('hidden');

                if (reviewData) {
                    console.log(`Hiển thị đánh giá cho kỳ ${selectedPeriodId}`);
                    // Populate data
                    reviewTicketId.textContent = reviewData.ticketId || 'N/A';
                     // Populate scores (ensure elements exist)
                    scoreProductKnowledge.textContent = reviewData.scores.product_knowledge ?? 'N/A';
                    document.getElementById('score_business_acumen').textContent = reviewData.scores.business_acumen ?? 'N/A';
                    document.getElementById('score_management').textContent = reviewData.scores.management ?? 'N/A';
                    document.getElementById('score_analysis').textContent = reviewData.scores.analysis ?? 'N/A';
                    document.getElementById('score_project_management').textContent = reviewData.scores.project_management ?? 'N/A';
                    document.getElementById('score_problem_solving').textContent = reviewData.scores.problem_solving ?? 'N/A';
                    document.getElementById('score_responsibility').textContent = reviewData.scores.responsibility ?? 'N/A';
                    document.getElementById('score_attitude').textContent = reviewData.scores.attitude ?? 'N/A';

                     // Calculate and display total score (simple sum for demo)
                     const total = Object.values(reviewData.scores).reduce((sum, score) => sum + (parseInt(score, 10) || 0), 0);
                     scoreTotal.textContent = total || 'N/A';


                    managerCommentsDisplay.textContent = reviewData.comments || '(Không có nhận xét)';
                    managerCommentsDisplay.style.fontStyle = reviewData.comments ? 'normal' : 'italic';

                    // Handle feedback visibility based on fetched state
                    if (reviewData.feedbackSubmitted) {
                         toggleFeedbackFormButton.classList.add('hidden'); // Hide button
                         feedbackSuccessMessage.classList.remove('hidden'); // Show submitted message
                         feedbackSuccessMessage.querySelector('span').textContent = 'Bạn đã gửi phản hồi cho đánh giá này.';
                    } else {
                         toggleFeedbackFormButton.classList.remove('hidden'); // Show button
                         feedbackForm.classList.add('hidden'); // Ensure form is hidden initially
                         feedbackSuccessMessage.classList.add('hidden');
                    }

                    managerReviewDisplayArea.classList.remove('hidden');
                } else {
                    console.log(`Không có đánh giá cho kỳ ${selectedPeriodId} hoặc kỳ chưa đóng.`);
                    reviewUnavailableMessage.classList.remove('hidden');
                }

            }, 1000);
        }

        function handleFeedbackSubmit(event) {
             event.preventDefault();
             hideMessages('feedback', feedbackForm.closest('.card-body')); // Hide previous messages
             const feedbackContent = document.getElementById('employeeFeedback').value.trim();
             const selectedPeriodId = reviewPeriodSelect.value; // Get context

             if (!feedbackContent) {
                 showMessage('feedback', 'error', 'Vui lòng nhập nội dung phản hồi.', feedbackForm.closest('.card-body'));
                 return;
             }

             submitFeedbackButton.disabled = true;
             submitFeedbackButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang gửi...';

             console.log(`Submitting feedback for period ${selectedPeriodId}:`, feedbackContent);

             // --- Simulate API Call ---
             setTimeout(() => {
                 console.log('Mô phỏng gửi phản hồi thành công.');
                 feedbackForm.classList.add('hidden'); // Hide form
                 feedbackSuccessMessage.classList.remove('hidden'); // Show success message
                 feedbackSuccessMessage.querySelector('span').textContent = 'Đã gửi phản hồi thành công.';
                 toggleFeedbackFormButton.classList.add('hidden'); // Hide the initial button

                 // Reset button state (though it's hidden now)
                 submitFeedbackButton.disabled = false;
                 submitFeedbackButton.innerHTML = '<i class="fas fa-paper-plane"></i> Gửi Phản hồi';

                 // Simulate error
                 /*
                 console.error('Mô phỏng lỗi gửi phản hồi.');
                 showMessage('feedback', 'error', 'Gửi phản hồi không thành công. Vui lòng thử lại.', feedbackForm.closest('.card-body'));
                 submitFeedbackButton.disabled = false;
                 submitFeedbackButton.innerHTML = '<i class="fas fa-paper-plane"></i> Gửi Phản hồi';
                 */
             }, 1000);
        }

    } // End of Evaluation Page Logic Check (if evaluationPage)

    // --- Khởi tạo Trang Ban đầu ---
    console.log('Hoàn tất khởi tạo. Hiển thị trang ban đầu.');
    // Mặc định hiển thị trang đăng nhập nếu chưa có logic kiểm tra session/token
    // if (checkLoginStatus()) { showPage('page-dashboard'); } else { showPage('page-login'); }
    showPage('page-login'); // Start with login page

});