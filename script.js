// ===================================================================================
// == 像素风Todolist打卡小游戏 - V6 最终完美版
// ===================================================================================

// --- 1. 初始化与常量定义 ---
const { createClient } = supabase;
const SUPABASE_URL = 'https://lqbtyhkvljyqpbtqanom.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxYnR5aGt2bGp5cXBidHFhbm9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzNzYyNjIsImV4cCI6MjA2NDk1MjI2Mn0.YiloY00GzPTB2A-D1ysfhIGBUhsZBtm4mwvB9SvNUzg';
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log('Supabase客户端已初始化');

let currentUser = null;

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
const leaderboardList = document.getElementById('leaderboard-list'); // <-- 这就是“失踪”的变量


// --- 2. 用户认证与引导逻辑 ---
async function handleLogin() {
    const email = emailInput.value.trim();
    if (!email) return alert('请输入邮箱地址！');
    try {
        const { error } = await supabaseClient.auth.signInWithOtp({ email });
        if (error) throw error;
        alert('登录链接已发送至您的邮箱，请检查！');
    } catch (error) { console.error('登录邮件发送失败:', error); }
}

async function onLoginSuccess(user) {
    if (currentUser && currentUser.id === user.id) return;
    currentUser = user;
    console.log("登录成功, 开始检查 Profile. 用户:", currentUser.id);
    const { data: profile, error } = await supabaseClient.from('profiles').select('*').eq('id', user.id).single();
    if (error) return console.error("获取用户Profile失败:", error);
    if (profile && profile.username) {
        console.log(`欢迎回来, ${profile.username}!`);
        usernameModalOverlay.style.display = 'none';
        authSection.style.display = 'none';
        gameSection.style.display = 'block';
        updatePityCounterUI(profile.pity_counter);
        updateLegendaryProgressUI(profile.task_completion_counter);
        fetchInventory();
        fetchAndRenderTodos();
        fetchAndRenderLeaderboard();
    } else {
        console.log("新用户或未设置用户名，弹出设置窗口。");
        authSection.style.display = 'none';
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
    if (todos.length === 0) { todolistContainer.innerHTML = '<li>太棒了，所有任务都完成了！</li>'; }
    else { todos.forEach(todo => { const li = document.createElement('li');
        li.className = todo.is_important ? 'important-task' : ''; li.innerHTML = `<input type="checkbox" class="complete-checkbox" data-task-id="${todo.id}" data-is-important="${todo.is_important}"><span>${todo.task_content}</span>`; todolistContainer.appendChild(li); }); }
}

async function handleAddTask() {
    const taskContent = taskInput.value.trim();
    if (!taskContent) return alert("任务内容不能为空！");
    if (!currentUser) return alert("用户未登录！");
    const isImportant = importantCheckbox.checked;
    const { error } = await supabaseClient.from('todos').insert({ task_content: taskContent, is_important: isImportant, user_id: currentUser.id });
    if (error) { console.error('添加任务失败:', error); } else { taskInput.value = ''; importantCheckbox.checked = false; fetchAndRenderTodos(); }
}

async function handleCompleteTask(checkbox, taskId, isImportant) {
    if (!currentUser) return;
    try {
        const MIN_INTERVAL_SECONDS = 60;
        const { data: profile } = await supabaseClient.from('profiles').select('last_task_completion_at').eq('id', currentUser.id).single();
        if (profile && profile.last_task_completion_at) {
            const secondsSinceLast = (new Date() - new Date(profile.last_task_completion_at)) / 1000;
            if (secondsSinceLast < MIN_INTERVAL_SECONDS) {
                const timeLeft = Math.ceil(MIN_INTERVAL_SECONDS - secondsSinceLast);
                rewardDisplay.innerHTML = `<p class="feedback-message error">操作太快了！请在 ${timeLeft} 秒后重试。</p>`;
                checkbox.disabled = false;
                return;
            }
        }
        await supabaseClient.from('profiles').update({ last_task_completion_at: new Date().toISOString() }).eq('id', currentUser.id);
        await supabaseClient.from('todos').update({ is_complete: true }).eq('id', taskId);
        fetchAndRenderTodos();
        checkForReward(isImportant);
    } catch (error) { console.error("完成任务流程出错:", error); checkbox.disabled = false; }
}


// --- 4. 游戏奖励与UI更新逻辑 ---
async function checkForReward(wasTaskImportant) {
    if (!currentUser) return;
    rewardDisplay.innerHTML = '';
    const { data: profile, error } = await supabaseClient.from('profiles').select('non_important_task_progress, task_completion_counter').eq('id', currentUser.id).single();
    if (error) return console.error("获取用户进度失败:", error);
    const newTotalTasks = profile.task_completion_counter + 1;
    await supabaseClient.from('profiles').update({ task_completion_counter: newTotalTasks }).eq('id', currentUser.id);
    updateLegendaryProgressUI(newTotalTasks);
    const LEGENDARY_PITY_THRESHOLD = 50;
    if (newTotalTasks >= LEGENDARY_PITY_THRESHOLD) {
        await grantLegendaryReward();
        await supabaseClient.from('profiles').update({ task_completion_counter: 0 }).eq('id', currentUser.id);
        updateLegendaryProgressUI(0);
        return;
    }
    if (wasTaskImportant) {
        await grantRandomReward("完成重要任务");
    } else {
        const newProgress = profile.non_important_task_progress + 1;
        if (newProgress >= 3) {
            await grantRandomReward("完成3个普通任务");
            await supabaseClient.from('profiles').update({ non_important_task_progress: 0 }).eq('id', currentUser.id);
        } else {
            await supabaseClient.from('profiles').update({ non_important_task_progress: newProgress }).eq('id', currentUser.id);
            rewardDisplay.innerHTML = `<p class="feedback-message">普通任务完成！当前进度：<span class="progress-highlight">${newProgress}/3</span>。加油！</p>`;
        }
    }
}

async function grantLegendaryReward() {
    try {
        const { data: legendaryRewards, error } = await supabaseClient.from('rewards').select('id, name, image_url, rarity, type').eq('rarity', '传说');
        if (error || !legendaryRewards || legendaryRewards.length === 0) throw new Error("大保底触发，但传说奖池为空!");
        const legendaryReward = legendaryRewards[Math.floor(Math.random() * legendaryRewards.length)];
        await supabaseClient.from('user_inventory').insert({ user_id: currentUser.id, reward_id: legendaryReward.id });
        await supabaseClient.from('profiles').update({ pity_counter: 0 }).eq('id', currentUser.id);
        updatePityCounterUI(0);
        const rarityClass = `rarity-${legendaryReward.rarity.toLowerCase()}`;
        rewardDisplay.innerHTML = `<h3 style="color: #ff8c00; font-weight:bold;">★★ 里程碑达成 ★★</h3><div class="reward-card ${rarityClass}"><img src="${legendaryReward.image_url}" alt="${legendaryReward.name}" /><h4>${legendaryReward.name}</h4><p>类别: ${legendaryReward.type}</p><p>稀有度: <span class="rarity-text">${legendaryReward.rarity}</span></p></div>`;
        await fetchInventory();
    } catch (error) { console.error('传说保底奖励发放流程出错:', error); }
}

async function grantRandomReward(reason) {
    if (!currentUser) return;
    const PITY_THRESHOLD = 20;
    const HIGH_RARITY_CATEGORIES = ['稀有', '史诗', '传说'];
    try {
        const { data: profile } = await supabaseClient.from('profiles').select('pity_counter').eq('id', currentUser.id).single();
        let currentPity = profile.pity_counter;
        let randomReward, isPityPull = false;
        if (currentPity >= PITY_THRESHOLD) {
            isPityPull = true;
            const { data: highRarityRewards } = await supabaseClient.from('rewards').select('id, name, image_url, rarity, type').in('rarity', HIGH_RARITY_CATEGORIES);
            randomReward = highRarityRewards[Math.floor(Math.random() * highRarityRewards.length)];
        } else {
            const { data: allRewards } = await supabaseClient.from('rewards').select('id, name, image_url, rarity, type');
            const weights = { '普通': 70, '稀有': 25, '史诗': 5, '传说': 1 };
            const weightedPool = allRewards.flatMap(r => Array(weights[r.rarity] || 1).fill(r));
            randomReward = weightedPool[Math.floor(Math.random() * weightedPool.length)];
        }
        let newPityCounter = HIGH_RARITY_CATEGORIES.includes(randomReward.rarity) ? 0 : currentPity + 1;
        await supabaseClient.from('profiles').update({ pity_counter: newPityCounter }).eq('id', currentUser.id);
        await supabaseClient.from('user_inventory').insert({ user_id: currentUser.id, reward_id: randomReward.id });
        const rarityClass = `rarity-${randomReward.rarity.toLowerCase()}`;
        const pityTitle = isPityPull ? `<h3>恭喜你获得! <span style="color: #ff8c00; font-weight:bold;">(触发保底)</span></h3>` : `<h3>恭喜你获得!</h3>`;
        rewardDisplay.innerHTML = `${pityTitle}<div class="reward-card ${rarityClass}"><img src="${randomReward.image_url}" alt="${randomReward.name}" /><h4>${randomReward.name}</h4><p>类别: ${randomReward.type}</p><p>稀有度: <span class="rarity-text">${randomReward.rarity}</span></p></div>`;
        await fetchInventory();
        updatePityCounterUI(newPityCounter);
    } catch (error) { console.error('奖励发放流程出错:', error); }
}

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
    leaderboardList.innerHTML = '<li>加载中...</li>';

    const { data, error } = await supabaseClient.from('leaderboard').select('*').order('rank', { ascending: true });

    if (error) { console.error('获取排行榜失败:', error); return leaderboardList.innerHTML = '<li>加载失败</li>'; }
    console.log('【排行榜数据抵达浏览器】:', data);

    leaderboardList.innerHTML = '';
    if (data.length === 0) { leaderboardList.innerHTML = '<li>排行榜暂无数据...</li>'; }
    else { data.forEach(player => {
        const li = document.createElement('li');

        li.innerHTML = `
        <span class="rank"></span> 
        <span class="username">${player.username}</span>
        <span class="score">${player.score}</span>
        `;

        leaderboardList.appendChild(li); }); }
}

function updatePityCounterUI(count) {
    if (pityValueElement) { pityValueElement.textContent = count; }
}

function updateLegendaryProgressUI(current) {
    const max = 50;
    if (legendaryProgressBar && legendaryProgressText) {
        const percentage = Math.min((current / max) * 100, 100);
        legendaryProgressBar.style.width = `${percentage}%`;
        legendaryProgressText.textContent = `${current} / ${max}`;
    }
}

// --- 5. 事件监听与程序入口 ---
loginButton.addEventListener('click', handleLogin);
if (logoutButton) { logoutButton.addEventListener('click', () => supabaseClient.auth.signOut()); }
saveUsernameButton.addEventListener('click', handleSaveUsername);
addTaskButton.addEventListener('click', handleAddTask);
todolistContainer.addEventListener('click', (event) => {
    if (event.target.classList.contains('complete-checkbox')) {
        const checkbox = event.target;
        checkbox.disabled = true;
        const taskId = checkbox.dataset.taskId;
        const isImportant = checkbox.dataset.isImportant === 'true';
        handleCompleteTask(checkbox, taskId, isImportant);
    }
});

supabaseClient.auth.onAuthStateChange((_event, session) => {
    console.log(`认证事件触发: ${_event}`);
    if (session) { onLoginSuccess(session.user); } else { onLogout(); }
});

// --- 背景音乐控制 ---

document.addEventListener('DOMContentLoaded', () => {

    // 1. 获取 HTML 中的元素
    const music = document.getElementById('background-music');
    const musicBtn = document.getElementById('music-toggle-btn');

    // 如果找不到元素，就直接退出，防止报错
    if (!music || !musicBtn) {
        console.log("音乐播放器或按钮未找到。");
        return;
    }

    // 默认设置为静音状态，让用户自己选择开启
    music.muted = true;
    musicBtn.textContent = '🔇';

    // 2. 切换静音/播放的功能函数
    function toggleMusic() {
        // 检查音乐当前是否是静音状态
        const isMuted = music.muted;

        if (isMuted) {
            // 如果是静音，则取消静音并播放
            music.muted = false;
            // 尝试播放音乐，play()会返回一个Promise
            music.play().catch(error => console.error("音乐播放失败:", error));
            musicBtn.textContent = '🔊'; // 更新按钮图标为“播放”
            musicBtn.title = '静音';
        } else {
            // 如果正在播放，则设置为静音
            music.muted = true;
            // music.pause(); // 你也可以选择暂停而不是仅静音
            musicBtn.textContent = '🔇'; // 更新按钮图标为“静音”
            musicBtn.title = '播放';
        }
    }

    // 3. 为按钮添加点击事件
    musicBtn.addEventListener('click', toggleMusic);

    // 4. (推荐) 首次用户交互后自动播放
    // 现代浏览器通常禁止自动播放音乐，直到用户与页面进行交互（如点击）
    // 这个函数只会在第一次点击时执行一次
    function playOnFirstInteraction() {
        console.log("用户首次交互，尝试播放背景音乐。");
        // 尝试播放，如果成功，浏览器后续将允许该网站播放音频
        music.play().catch(error => {
            // 如果播放失败（例如，在某些移动设备上），也没关系
            // 用户仍然可以手动点击按钮来播放
            console.log("首次自动播放失败，等待用户手动开启。");
        });

        // 播放后，移除这个一次性的事件监听器
        document.body.removeEventListener('click', playOnFirstInteraction);
        document.body.removeEventListener('keydown', playOnFirstInteraction);
    }

    // 为页面添加一次性的点击或键盘事件监听器
    document.body.addEventListener('click', playOnFirstInteraction, { once: true });
    document.body.addEventListener('keydown', playOnFirstInteraction, { once: true });

});
// --- 实现任务输入框回车提交 ---

document.addEventListener('DOMContentLoaded', () => {

    // 1. 获取输入框和（已隐藏的）按钮
    const taskInput = document.getElementById('task-input');
    const addTaskButton = document.getElementById('add-task-button');

    // 如果找不到输入框，就退出
    if (!taskInput) return;

    // 2. 为输入框添加一个键盘事件监听器
    taskInput.addEventListener('keydown', function(event) {

        // 3. 判断按下的键是否是“Enter”
        if (event.key === 'Enter') {

            // 4. 阻止默认行为（比如表单提交导致页面刷新）
            event.preventDefault();

            // 5. 检查输入框是否为空，如果不为空则执行点击
            if (taskInput.value.trim() !== '') {

                // 6. 神奇的一步：以编程方式“点击”我们隐藏的按钮
                // 这样做的好处是，我们不需要重复写添加任务的逻辑
                addTaskButton.click();
            }
        }
    });
});