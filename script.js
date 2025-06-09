// ===================================================================================
// == 像素风Todolist打卡小游戏 - V4 最终修复版
// ===================================================================================

// --- 1. 初始化与常量定义 ---

// Supabase 客户端初始化
const { createClient } = supabase;
const SUPABASE_URL = 'https://lqbtyhkvljyqpbtqanom.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxYnR5aGt2bGp5cXBidHFhbm9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzNzYyNjIsImV4cCI6MjA2NDk1MjI2Mn0.YiloY00GzPTB2A-D1ysfhIGBUhsZBtm4mwvB9SvNUzg';
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log('Supabase客户端已初始化');

// 全局变量
let currentUser = null;

const usernameModalOverlay = document.getElementById('username-modal-overlay');
const usernameInput = document.getElementById('username-input');
const saveUsernameButton = document.getElementById('save-username-button');
const leaderboardList = document.getElementById('leaderboard-list');
// 获取所有需要操作的HTML元素
const authSection = document.getElementById('auth-section');
const gameSection = document.getElementById('game-section');
const loginButton = document.getElementById('login-button');
const emailInput = document.getElementById('email-input');
const logoutButton = document.getElementById('logout-button');

const addTaskButton = document.getElementById('add-task-button');
const taskInput = document.getElementById('task-input');
const importantCheckbox = document.getElementById('important-checkbox');
const todolistContainer = document.getElementById('todolist-container');

const rewardDisplay = document.getElementById('reward-display');
const inventoryDisplay = document.getElementById('inventory-display');
const pityValueElement = document.getElementById('pity-value');
const legendaryProgressBar = document.getElementById('legendary-progress-bar');
const legendaryProgressText = document.getElementById('legendary-progress-text');


// --- 2. 用户认证核心逻辑 ---

async function handleLogin() {
    const email = emailInput.value.trim();
    if (!email) return alert('请输入邮箱地址！');
    try {
        const { error } = await supabaseClient.auth.signInWithOtp({ email });
        if (error) throw error;
        alert('登录链接已发送至您的邮箱，请检查！');
    } catch (error) {
        console.error('登录邮件发送失败:', error);
        alert(`登录失败: ${error.message}`);
    }
}

// script.js

/**
 * (全新升级版) 用户成功登录后的“守门员”函数
 * @param {object} user - Supabase用户对象
 */
async function onLoginSuccess(user) {
    if (currentUser && currentUser.id === user.id) return;
    currentUser = user;
    console.log("登录成功, 开始检查 Profile. 用户:", currentUser.id);

    // 关键一步：获取用户的完整profile
    const { data: profile, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (error) {
        return console.error("获取用户Profile失败:", error);
    }

    // 检查用户名是否存在
    if (profile && profile.username) {
        // --- 情况A: 老玩家，直接进入游戏 ---
        console.log(`欢迎回来, ${profile.username}!`);
        usernameModalOverlay.style.display = 'none'; // 确保弹窗是隐藏的
        authSection.style.display = 'none';
        gameSection.style.display = 'block';

        // 加载所有游戏数据
        updatePityCounterUI(profile.pity_counter);
        updateLegendaryProgressUI(profile.task_completion_counter);
        fetchInventory();
        fetchAndRenderTodos();
        fetchAndRenderLeaderboard();
    } else {
        // --- 情况B: 新玩家，强制设置用户名 ---
        console.log("新用户或未设置用户名，弹出设置窗口。");
        authSection.style.display = 'none';
        gameSection.style.display = 'none'; // 隐藏游戏主界面
        usernameModalOverlay.style.display = 'flex'; // 显示设置弹窗
    }
}

function onLogout() {
    currentUser = null;
    console.log("用户未登录或已退出，显示登录界面。");
    authSection.style.display = 'block';
    gameSection.style.display = 'none';
}

// script.js (函数区)
/**
 * 获取并渲染排行榜数据
 */
async function fetchAndRenderLeaderboard() {
    if (!leaderboardList) return;
    leaderboardList.innerHTML = '<li>加载中...</li>';

    // 查询预先计算好的leaderboard表，这个查询非常快！
    const { data, error } = await supabaseClient
    .from('leaderboard')
    .select('username, score') // 只选择我们需要的字段
    .order('score', { ascending: false }); // 直接根据分数从高到低排序

    if (error) {
        console.error("获取排行榜失败:", error);
        return leaderboardList.innerHTML = '<li>加载失败</li>';
    }

    leaderboardList.innerHTML = '';
    if (data.length === 0) {
        leaderboardList.innerHTML = '<li>排行榜暂无数据，快去收集传说食物吧！</li>';
    } else {
        data.forEach(player => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="rank"></span> 
                <span class="username">${player.username}</span>
                <span class="score">${player.score}</span>
                `;
            leaderboardList.appendChild(li);
        });
    }
}


// --- 3. Todolist 功能函数 ---

async function fetchAndRenderTodos() {
    if (!leaderboardList) return;
    leaderboardList.innerHTML = '<li>加载中...</li>';

    const {data, error} = await supabaseClient
        .from('leaderboard')
        .select('*')
        .order('rank', {ascending: true});

    // ▼▼▼▼▼ 添加这两行决定性的“监控代码” ▼▼▼▼▼
    console.log('【Vercel 实况】刚从Supabase收到的排行榜数据:', data);
    console.error('【Vercel 实况】获取排行榜时发生的错误:', error);
    // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

    if (error) {
        console.error("获取排行榜失败:", error); // 这行可以保留，也可以删除
        return leaderboardList.innerHTML = '<li>加载失败</li>';
    }

    // ... 后续的渲染逻辑保持不变 ...
    leaderboardList.innerHTML = '';
    if (data.length === 0) {
        leaderboardList.innerHTML = '<li>排行榜暂无数据，快去收集传说食物吧！</li>';
    } else {
        data.forEach(player => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="rank">${player.rank}.</span>
                <span class="username">${player.username}</span>
                <span class="score">${player.score}</span>
            `;
            leaderboardList.appendChild(li);
        });
    }
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
        const { data: profile, error: profileError } = await supabaseClient.from('profiles').select('last_task_completion_at').eq('id', currentUser.id).single();
        if (profileError) throw new Error("获取用户信息失败，无法校验时间。");
        if (profile.last_task_completion_at) {
            const lastCompletionTime = new Date(profile.last_task_completion_at);
            const now = new Date();
            const secondsSinceLast = (now - lastCompletionTime) / 1000;
            if (secondsSinceLast < MIN_INTERVAL_SECONDS) {
                const timeLeft = Math.ceil(MIN_INTERVAL_SECONDS - secondsSinceLast);
                console.warn(`操作过于频繁！冷却时间剩余: ${timeLeft}秒`);
                rewardDisplay.innerHTML = `<p class="feedback-message error">操作太快了！请在 ${timeLeft} 秒后重试。</p>`;
                checkbox.disabled = false;
                return;
            }
        }
        const { error: updateTimestampError } = await supabaseClient.from('profiles').update({ last_task_completion_at: new Date().toISOString() }).eq('id', currentUser.id);
        if (updateTimestampError) throw new Error("更新任务时间戳失败。");
        const { error: updateTaskError } = await supabaseClient.from('todos').update({ is_complete: true }).eq('id', taskId);
        if (updateTaskError) throw new Error("更新任务状态失败。");
        fetchAndRenderTodos();
        checkForReward(isImportant);
    } catch (error) {
        console.error("完成任务流程出错:", error);
        rewardDisplay.innerHTML = `<p class="feedback-message error">哎呀，出错了: ${error.message}</p>`;
        checkbox.disabled = false;
    }
}


// --- 4. 游戏奖励与UI更新逻辑 ---

async function checkForReward(wasTaskImportant) {
    if (!currentUser) return;
    rewardDisplay.innerHTML = '';
    const { data: profile, error: profileError } = await supabaseClient.from('profiles').select('non_important_task_progress, task_completion_counter').eq('id', currentUser.id).single();
    if (profileError) { console.error("获取用户进度失败:", profileError); return rewardDisplay.innerHTML = `<p class="feedback-message error">获取用户进度失败</p>`; }
    const newTotalTasks = profile.task_completion_counter + 1;
    await supabaseClient.from('profiles').update({ task_completion_counter: newTotalTasks }).eq('id', currentUser.id);
    updateLegendaryProgressUI(newTotalTasks);
    const LEGENDARY_PITY_THRESHOLD = 50;
    if (newTotalTasks >= LEGENDARY_PITY_THRESHOLD) {
        console.warn(`★★★★★ 大保底触发！总任务数: ${newTotalTasks}`);
        await grantLegendaryReward();
        await supabaseClient.from('profiles').update({ task_completion_counter: 0 }).eq('id', currentUser.id);
        updateLegendaryProgressUI(0);
        return;
    }
    if (wasTaskImportant) {
        await grantRandomReward("完成重要任务");
    } else {
        const newProgress = profile.non_important_task_progress + 1;
        console.log(`非重要任务进度: ${newProgress}/3`);
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
    console.log("正在发放传说保底奖励...");
    rewardDisplay.innerHTML = `<p>检测到里程碑达成！正在为您颁发传说级奖励...</p>`;
    try {
        const { data: legendaryRewards, error } = await supabaseClient.from('rewards').select('id, name, image_url, rarity, type').eq('rarity', '传说');
        if (error || !legendaryRewards || legendaryRewards.length === 0) throw new Error("大保底触发，但传说奖池为空或获取失败！");
        const legendaryReward = legendaryRewards[Math.floor(Math.random() * legendaryRewards.length)];
        console.log(`传说保底获得: ${legendaryReward.name}`);
        await supabaseClient.from('user_inventory').insert({ user_id: currentUser.id, reward_id: legendaryReward.id });
        await supabaseClient.from('profiles').update({ pity_counter: 0 }).eq('id', currentUser.id);
        updatePityCounterUI(0);
        const rarityClass = `rarity-${legendaryReward.rarity.toLowerCase()}`;
        rewardDisplay.innerHTML = `<h3 style="color: #ff8c00; font-weight:bold;">★★ 里程碑达成 ★★</h3><div class="reward-card ${rarityClass}"><img src="${legendaryReward.image_url}" alt="${legendaryReward.name}" /><h4>${legendaryReward.name}</h4><p>类别: ${legendaryReward.type}</p><p>稀有度: <span class="rarity-text">${legendaryReward.rarity}</span></p></div>`;
        await fetchInventory();
    } catch (error) {
        console.error('传说保底奖励发放流程出错:', error);
        rewardDisplay.innerHTML = `<p style="color:red;">哎呀，传说奖励发放出错了: ${error.message}</p>`;
    }
}

async function grantRandomReward(reason) {
    console.log(`开始发放奖励，原因: ${reason}`);
    rewardDisplay.innerHTML = `<p>正在为你抽取奖励...</p>`;
    if (!currentUser) return console.error("用户未登录，无法发放奖励");
    const PITY_THRESHOLD = 20;
    const HIGH_RARITY_CATEGORIES = ['稀有', '史诗', '传说'];
    try {
        const { data: profile, error: profileError } = await supabaseClient.from('profiles').select('pity_counter').eq('id', currentUser.id).single();
        if (profileError) throw new Error(`获取用户保底信息失败: ${profileError.message}`);
        let currentPity = profile.pity_counter;
        let randomReward;
        let isPityPull = false;
        if (currentPity >= PITY_THRESHOLD) {
            console.warn(`保底机制触发！当前计数: ${currentPity}`);
            isPityPull = true;
            const { data: highRarityRewards, error: pityError } = await supabaseClient.from('rewards').select('id, name, image_url, rarity, type').in('rarity', HIGH_RARITY_CATEGORIES);
            if (pityError || highRarityRewards.length === 0) throw new Error("保底触发，但获取高稀有度物品失败！");
            randomReward = highRarityRewards[Math.floor(Math.random() * highRarityRewards.length)];
        } else {
            const { data: allRewards, error: rewardsError } = await supabaseClient.from('rewards').select('id, name, image_url, rarity, type');
            if (rewardsError) throw rewardsError;
            if (allRewards.length === 0) throw new Error("奖励池是空的！");
            const weights = { '普通': 70, '稀有': 25, '史诗': 5, '传说': 1 };
            const weightedPool = [];
            allRewards.forEach(reward => { const weight = weights[reward.rarity] || 1; for (let i = 0; i < weight; i++) { weightedPool.push(reward); } });
            randomReward = weightedPool[Math.floor(Math.random() * weightedPool.length)];
        }
        let newPityCounter;
        if (HIGH_RARITY_CATEGORIES.includes(randomReward.rarity)) {
            console.log(`抽中高稀有度物品 [${randomReward.rarity}]，保底计数器清零。`);
            newPityCounter = 0;
        } else {
            newPityCounter = currentPity + 1;
            console.log(`未抽中高稀有度物品，保底计数器: ${newPityCounter}`);
        }
        await supabaseClient.from('profiles').update({ pity_counter: newPityCounter }).eq('id', currentUser.id);
        await supabaseClient.from('user_inventory').insert({ user_id: currentUser.id, reward_id: randomReward.id });
        const rarityClass = `rarity-${randomReward.rarity.toLowerCase()}`;
        const pityTitle = isPityPull ? `<h3>恭喜你获得! <span style="color: #ff8c00; font-weight:bold;">(触发保底)</span></h3>` : `<h3>恭喜你获得!</h3>`;
        rewardDisplay.innerHTML = `${pityTitle}<div class="reward-card ${rarityClass}"><img src="${randomReward.image_url}" alt="${randomReward.name}" /><h4>${randomReward.name}</h4><p>类别: ${randomReward.type}</p><p>稀有度: <span class="rarity-text">${randomReward.rarity}</span></p></div>`;
        await fetchInventory();
        updatePityCounterUI(newPityCounter);
    } catch (error) {
        console.error('奖励发放流程出错:', error);
        rewardDisplay.innerHTML = `<p style="color:red;">哎呀，奖励发放出错了: ${error.message}</p>`;
    }
}

async function fetchInventory() {
    if (!currentUser) return;
    inventoryDisplay.innerHTML = '加载中...';
    const { data, error } = await supabaseClient.from('user_inventory').select(`rewards(id, name, image_url, type, rarity)`).eq('user_id', currentUser.id);
    if (error) { console.error('获取仓库失败:', error); return inventoryDisplay.innerHTML = '加载失败'; }
    inventoryDisplay.innerHTML = '';
    if (data.length === 0) {
        inventoryDisplay.innerHTML = '<p>你的收藏还是空的，快去完成任务吧！</p>';
    } else {
        data.forEach(item => { const reward = item.rewards; if (!reward) return; const rarityClass = `rarity-${reward.rarity.toLowerCase()}`; const itemDiv = document.createElement('div'); itemDiv.className = `inventory-item ${rarityClass}`; itemDiv.title = `${reward.name}\n稀有度: ${reward.rarity}\n类别: ${reward.type}`; itemDiv.innerHTML = `<img src="${reward.image_url}" alt="${reward.name}" /><div class="item-name">${reward.name}</div>`; inventoryDisplay.appendChild(itemDiv); });
    }
}

function updatePityCounterUI(count) {
    if (pityValueElement) {
        pityValueElement.textContent = count;
    }
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

/**
 * 处理保存用户名的逻辑
 */
async function handleSaveUsername() {
    const newUsername = usernameInput.value.trim();
    if (!newUsername) {
        return alert("昵称不能为空！");
    }
    if (newUsername.length > 15) {
        return alert("昵称不能超过15个字符！");
    }
    if (!currentUser) return;

    // 更新到数据库
    const { error } = await supabaseClient
        .from('profiles')
        .update({ username: newUsername })
        .eq('id', currentUser.id);

    if (error) {
        console.error("更新用户名失败:", error);
        alert("设置失败，请稍后重试。");
    } else {
        console.log("用户名设置成功!");
        // 重新调用 onLoginSuccess，这次因为用户名已存在，会直接进入游戏
        onLoginSuccess(currentUser);
    }
}

// 新增：为保存用户名按钮绑定事件
saveUsernameButton.addEventListener('click', handleSaveUsername);


// 绑定UI元素的点击事件
loginButton.addEventListener('click', handleLogin);
logoutButton.addEventListener('click', () => supabaseClient.auth.signOut());
addTaskButton.addEventListener('click', handleAddTask);

// 为整个任务列表容器设置一个事件监听器（事件委托）
todolistContainer.addEventListener('click', (event) => {
    if (event.target.classList.contains('complete-checkbox')) {
        const checkbox = event.target;
        checkbox.disabled = true;
        const taskId = checkbox.dataset.taskId;
        const isImportant = checkbox.dataset.isImportant === 'true';
        handleCompleteTask(checkbox, taskId, isImportant);
    }
});

// === 最终的程序入口 ===
// onAuthStateChange 会处理所有认证情况
supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log(`认证事件触发: ${event}`);
    if (session) {
        onLoginSuccess(session.user);
    } else {
        onLogout();
    }
});