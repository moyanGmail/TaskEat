// ===================================================================================
// == 像素风Todolist打卡小游戏 - V8 终极典藏版
// ===================================================================================

// --- 1. 初始化与常量定义 ---
const { createClient } = supabase;
const SUPABASE_URL = 'https://lqbtyhkvljyqpbtqanom.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxYnR5aGt2bGp5cXBidHFhbm9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzNzYyNjIsImV4cCI6MjA2NDk1MjI2Mn0.YiloY00GzPTB2A-D1ysfhIGBUhsZBtm4mwvB9SvNUzg';
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log('Supabase客户端已初始化');

let currentUser = null;
let maxStamina = 100;

// 获取所有需要操作的HTML元素
const authSection = document.getElementById('auth-section');
const gameSection = document.getElementById('game-section');
const loginButton = document.getElementById('login-button');
const emailInput = document.getElementById('email-input');
const logoutButton = document.getElementById('logout-button');
const usernameModalOverlay = document.getElementById('username-modal-overlay');
const usernameInput = document.getElementById('username-input');
const saveUsernameButton = document.getElementById('save-username-button');
const addTaskButton = document.getElementById('add-task-button');
const taskInput = document.getElementById('task-input');
const importantCheckbox = document.getElementById('important-checkbox');
const todolistContainer = document.getElementById('todolist-container');
const rewardDisplay = document.getElementById('reward-display');
const inventoryDisplay = document.getElementById('inventory-display');
const pityValueElement = document.getElementById('pity-value');
const legendaryProgressBar = document.getElementById('legendary-progress-bar');
const legendaryProgressText = document.getElementById('legendary-progress-text');
const leaderboardList = document.getElementById('leaderboard-list');
const staminaBarInner = document.getElementById('stamina-bar-inner');
const staminaText = document.getElementById('stamina-text');
const backgroundMusic = document.getElementById('background-music');
const musicToggleButton = document.getElementById('music-toggle-btn');


// --- 2. 用户认证与引导逻辑 ---
async function handleLogin() {
    const email = emailInput.value.trim();
    if (!email) return alert('请输入邮箱地址！');
    try {
        const { error } = await supabaseClient.auth.signInWithOtp({ email });
        if (error) throw error;
        alert('登录链接已发送至您的邮箱，请检查！');
    } catch (error) {
        console.error('登录邮件发送失败:', error);
    }
}

async function onLoginSuccess(user) {
    if (currentUser && currentUser.id === user.id) return;
    currentUser = user;
    console.log("登录成功, 开始检查 Profile. 用户:", currentUser.id);
    authSection.style.display = 'none';

    const { data: profile, error } = await supabaseClient.from('profiles').select('*').eq('id', user.id).single();
    if (error) return console.error("获取用户Profile失败:", error);

    if (profile && profile.username) {
        console.log(`欢迎回来, ${profile.username}!`);
        usernameModalOverlay.style.display = 'none';
        gameSection.style.display = 'block';

        const { data: status, error: statusError } = await supabaseClient.rpc('update_and_get_stamina', { user_id_input: currentUser.id });
        if (statusError) return console.error("获取用户状态失败:", statusError);

        const { current_stamina, is_currently_starving } = status[0];
        maxStamina = profile.max_stamina;
        updateStaminaUI(current_stamina, maxStamina);

        if (is_currently_starving) {
            rewardDisplay.innerHTML = `<div class="feedback-message error">你饿死了！所有食物都被清空了！完成一个重要任务来复活吧！</div>`;
        }

        updatePityCounterUI(profile.pity_counter);
        updateLegendaryProgressUI(profile.task_completion_counter);
        fetchInventory();
        fetchAndRenderTodos();
        fetchAndRenderLeaderboard();
    } else {
        console.log("新用户或未设置用户名，弹出设置窗口。");
        gameSection.style.display = 'none';
        usernameModalOverlay.style.display = 'flex';
    }
}

function onLogout() {
    currentUser = null;
    console.log("用户未登录或已退出。");
    authSection.style.display = 'block';
    gameSection.style.display = 'none';
    usernameModalOverlay.style.display = 'none';
}

async function handleSaveUsername() {
    const newUsername = usernameInput.value.trim();
    if (!newUsername) return alert("昵称不能为空！");
    if (newUsername.length > 15) return alert("昵称不能超过15个字符！");
    if (!currentUser) return;
    const { error } = await supabaseClient.from('profiles').update({ username: newUsername }).eq('id', currentUser.id);
    if (error) { console.error("更新用户名失败:", error); } else { console.log("用户名设置成功!"); onLoginSuccess(currentUser); }
}


// --- 3. Todolist 功能函数 ---
async function fetchAndRenderTodos() {
    if (!currentUser) return;
    todolistContainer.innerHTML = '<li>加载中...</li>';
    const { data: todos, error } = await supabaseClient.from('todos').select('*').eq('user_id', currentUser.id).eq('is_complete', false).order('created_at', { ascending: false });
    if (error) { console.error('获取任务列表失败:', error); return todolistContainer.innerHTML = '<li>加载任务失败</li>'; }
    todolistContainer.innerHTML = '';
    if (todos.length === 0) { todolistContainer.innerHTML = '<li>太棒了，所有任务都完成了！</li>'; } else { todos.forEach(todo => { const li = document.createElement('li'); li.className = todo.is_important ? 'important-task' : ''; li.innerHTML = `<input type="checkbox" class="complete-checkbox" data-task-id="${todo.id}" data-is-important="${todo.is_important}"><span>${todo.task_content}</span>`; todolistContainer.appendChild(li); }); }
}

async function handleAddTask() {
    const taskContent = taskInput.value.trim();
    if (!taskContent) return alert("任务内容不能为空！");
    if (!currentUser) return alert("用户未登录！");
    const isImportant = importantCheckbox.checked;
    const { error } = await supabaseClient.from('todos').insert({ task_content: taskContent, is_important: isImportant, user_id: currentUser.id });
    if (error) {
        console.error('添加任务失败:', error);
    } else {
        console.log("任务添加成功，准备刷新列表...");
        taskInput.value = '';
        importantCheckbox.checked = false;
        fetchAndRenderTodos(); // 核心修复：确保刷新列表的函数被调用
    }
}

async function handleCompleteTask(checkbox, taskId, isImportant) {
    if (!currentUser) return;
    rewardDisplay.innerHTML = '';
    try {
        const { data, error } = await supabaseClient.rpc('complete_task_and_get_reward', {
            task_id_input: taskId,
            is_important_input: isImportant
        });
        if (error) throw error;
        const result = data[0];
        console.log("后端返回结果:", result);
        updateStaminaUI(result.final_stamina, maxStamina);
        if (result.reward_name) {
            const rarityClass = `rarity-${result.reward_rarity.toLowerCase()}`;
            rewardDisplay.innerHTML = `<h3>${result.feedback_message}</h3><div class="reward-card ${rarityClass}"><img src="${result.reward_image}" alt="${result.reward_name}" /><h4>${result.reward_name}</h4><p>类别: ${result.reward_type}</p><p>稀有度: <span class="rarity-text">${result.reward_rarity}</span></p></div>`;
            fetchInventory();
        } else {
            rewardDisplay.innerHTML = `<p class="feedback-message">${result.feedback_message}</p>`;
        }
    } catch (error) {
        console.error("完成任务流程出错:", error);
        rewardDisplay.innerHTML = `<p class="feedback-message error">哎呀，出错了: ${error.message}</p>`;
        checkbox.disabled = false;
    } finally {
        fetchAndRenderTodos();
    }
}

// --- 4. 游戏奖励与UI更新逻辑 ---
async function fetchInventory() {
    if (!currentUser) return;
    inventoryDisplay.innerHTML = '加载中...';
    const { data, error } = await supabaseClient.from('user_inventory').select(`rewards(id, name, image_url, type, rarity)`).eq('user_id', currentUser.id);
    if (error) { return console.error('获取仓库失败:', error); }
    inventoryDisplay.innerHTML = '';
    if (data.length === 0) { inventoryDisplay.innerHTML = '<p>你的收藏还是空的...</p>'; } else { data.forEach(item => { const reward = item.rewards; if (!reward) return; const rarityClass = `rarity-${reward.rarity.toLowerCase()}`; const itemDiv = document.createElement('div'); itemDiv.className = `inventory-item ${rarityClass}`; itemDiv.title = `${reward.name}\n稀有度: ${reward.rarity}\n类别: ${reward.type}`; itemDiv.innerHTML = `<img src="${reward.image_url}" alt="${reward.name}" /><div class="item-name">${reward.name}</div>`; inventoryDisplay.appendChild(itemDiv); }); }
}

async function fetchAndRenderLeaderboard() {
    if (!leaderboardList) return;
    leaderboardList.innerHTML = '<div class="leaderboard-item">加载中...</div>';
    const { data, error } = await supabaseClient.from('leaderboard').select('*').order('rank', { ascending: true });
    if (error) { console.error('获取排行榜失败:', error); return leaderboardList.innerHTML = '<div class="leaderboard-item" style="color: red;">加载失败</div>'; }
    leaderboardList.innerHTML = '';
    if (data.length === 0) {
        leaderboardList.innerHTML = '<div class="leaderboard-item">排行榜暂无数据...</div>';
    } else {
        data.forEach(player => {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'leaderboard-item';
            const rankNumber = parseInt(player.rank, 10);
            const rankText = isNaN(rankNumber) ? '?. ' : `${rankNumber}. `;
            const rankSpan = `<span class="rank">${rankText}</span>`;
            const userSpan = `<span class="username">${player.username}</span>`;
            const scoreSpan = `<span class="score">${player.score}</span>`;
            playerDiv.innerHTML = rankSpan + userSpan + scoreSpan;
            leaderboardList.appendChild(playerDiv);
        });
    }
}

function updatePityCounterUI(count) { if (pityValueElement) { pityValueElement.textContent = count; } }
function updateLegendaryProgressUI(current) { const max = 50; if (legendaryProgressBar && legendaryProgressText) { const percentage = Math.min((current / max) * 100, 100); legendaryProgressBar.style.width = `${percentage}%`; legendaryProgressText.textContent = `${current} / ${max}`; } }
function updateStaminaUI(current, max) { if (!staminaBarInner || !staminaText) return; const percentage = Math.max(0, (current / max) * 100); staminaBarInner.style.width = `${percentage}%`; staminaText.textContent = `${current} / ${max}`; }

// --- 5. 事件监听与程序入口 ---
loginButton.addEventListener('click', handleLogin);
if (logoutButton) { logoutButton.addEventListener('click', () => supabaseClient.auth.signOut()); }
saveUsernameButton.addEventListener('click', handleSaveUsername);
addTaskButton.addEventListener('click', handleAddTask);
taskInput.addEventListener('keypress', function(event) {
    // 检查用户按下的键是否是“Enter”
    if (event.key === 'Enter') {
        // 阻止回车键的默认行为（比如提交表单）
        event.preventDefault();
        // 模拟点击“添加任务”按钮
        addTaskButton.click();
    }
});
todolistContainer.addEventListener('click', (event) => {
    if (event.target.classList.contains('complete-checkbox')) {
        const checkbox = event.target;
        checkbox.disabled = true;
        const taskId = checkbox.dataset.taskId;
        const isImportant = checkbox.dataset.isImportant === 'true';
        handleCompleteTask(checkbox, taskId, isImportant);
    }
});

// 新增：音频播放逻辑
if (musicToggleButton && backgroundMusic) {
    musicToggleButton.addEventListener('click', () => {
        // 浏览器的autoplay策略要求必须有用户交互才能播放音频
        if (backgroundMusic.paused) {
            backgroundMusic.play().catch(e => console.error("音频播放失败:", e));
            musicToggleButton.textContent = '🔇';
        } else {
            backgroundMusic.pause();
            musicToggleButton.textContent = '🔊';
        }
    });
}

// 最终的程序入口
supabaseClient.auth.onAuthStateChange((_event, session) => {
    console.log(`认证事件触发: ${_event}`);
    if (session) { onLoginSuccess(session.user); } else { onLogout(); }
});