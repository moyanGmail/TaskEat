// --- 1. 初始化与常量定义 ---

// Supabase 客户端初始化
const { createClient } = supabase;
const SUPABASE_URL = 'https://lqbtyhkvljyqpbtqanom.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxYnR5aGt2bGp5cXBidHFhbm9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzNzYyNjIsImV4cCI6MjA2NDk1MjI2Mn0.YiloY00GzPTB2A-D1ysfhIGBUhsZBtm4mwvB9SvNUzg';
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log('Supabase客户端已初始化');

// 全局变量，用于存储当前登录用户的信息
let currentUser = null;


const legendaryProgressBar = document.getElementById('legendary-progress-bar');
const legendaryProgressText = document.getElementById('legendary-progress-text');
const pityValueElement = document.getElementById('pity-value');
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


// --- 2. 用户认证核心逻辑 ---

/**
 * 处理用户点击“发送登录链接”按钮
 */
async function handleLogin() {
    const email = emailInput.value.trim();
    if (!email) {
        return alert('请输入邮箱地址！');
    }
    try {
        const { error } = await supabaseClient.auth.signInWithOtp({ email });
        if (error) throw error;
        alert('登录链接已发送至您的邮箱，请检查！');
    } catch (error) {
        console.error('登录邮件发送失败:', error);
        alert(`登录失败: ${error.message}`);
    }
}

/**
 * 当用户成功登录后，所有需要执行的操作都放在这里
 * @param {object} user - Supabase返回的用户对象
 */
async function onLoginSuccess(user) { // <<<< 把函数变成 async
    if (currentUser && currentUser.id === user.id) return;
    currentUser = user;
    console.log("登录成功, 更新UI. 用户:", currentUser.id);
    authSection.style.display = 'none';
    gameSection.style.display = 'block';

    // 同时获取并更新两个计数器的UI
    const { data: profile } = await supabaseClient
        .from('profiles')
        .select('pity_counter, task_completion_counter')
        .eq('id', user.id)
        .single();

    if (profile) {
        updatePityCounterUI(profile.pity_counter);
        updateLegendaryProgressUI(profile.task_completion_counter);
    }

    // 加载用户的游戏数据
    fetchInventory();
    fetchAndRenderTodos();
}

/**
 * 当用户未登录或退出时，所有需要执行的操作都放在这里
 */
function onLogout() {
    currentUser = null;
    console.log("用户未登录或已退出，显示登录界面。");

    // 切换界面显示
    authSection.style.display = 'block';
    gameSection.style.display = 'none';
}

// --- 3. Todolist 功能函数 ---
/**
 * 更新界面上的保底计数器显示
 * @param {number} count - 当前的计数值
 */
function updatePityCounterUI(count) {
    if (pityValueElement) {
        pityValueElement.textContent = count;
    }
}

/**
 * 从数据库获取并渲染当前用户的待办任务列表
 */
async function fetchAndRenderTodos() {
    if (!currentUser) return;
    todolistContainer.innerHTML = '<li>加载中...</li>';

    const { data: todos, error } = await supabaseClient
        .from('todos')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('is_complete', false) // 只显示未完成的任务
        .order('created_at', { ascending: false }); // 新任务显示在最上面

    if (error) {
        console.error('获取任务列表失败:', error);
        return todolistContainer.innerHTML = '<li>加载任务失败</li>';
    }

    todolistContainer.innerHTML = ''; // 清空列表
    if (todos.length === 0) {
        todolistContainer.innerHTML = '<li>太棒了，所有任务都完成了！</li>';
    } else {
        todos.forEach(todo => {
            const li = document.createElement('li');
            li.className = todo.is_important ? 'important-task' : '';
            li.innerHTML = `
                <input type="checkbox" class="complete-checkbox" data-task-id="${todo.id}" data-is-important="${todo.is_important}">
                <span>${todo.task_content}</span>
            `;
            todolistContainer.appendChild(li);
        });
    }
}

/**
 * 处理用户点击“添加任务”按钮
 */
async function handleAddTask() {
    const taskContent = taskInput.value.trim();
    if (!taskContent) return alert("任务内容不能为空！");
    if (!currentUser) return alert("用户未登录！");

    const isImportant = importantCheckbox.checked;

    const { error } = await supabaseClient
        .from('todos')
        .insert({
            task_content: taskContent,
            is_important: isImportant,
            user_id: currentUser.id
        });

    if (error) {
        console.error('添加任务失败:', error);
    } else {
        taskInput.value = '';
        importantCheckbox.checked = false;
        fetchAndRenderTodos(); // 添加成功后，立即刷新任务列表
    }
}

/**
 * 处理用户点击“完成任务”的复选框
 * @param {string} taskId - 被完成任务的ID
 * @param {boolean} isImportant - 被完成任务是否是重要任务
 */
async function handleCompleteTask(taskId, isImportant) {
    // 1. 在数据库中将任务标记为已完成
    const { error } = await supabaseClient
        .from('todos')
        .update({ is_complete: true })
        .eq('id', taskId);

    if (error) return console.error('更新任务状态失败:', error);

    // 2. 重新渲染UI (此函数会自动移除已完成的任务)
    fetchAndRenderTodos();

    // 3. 检查是否应该获得奖励 (调用核心游戏逻辑)
    checkForReward(isImportant);
}


// --- 4. 游戏奖励核心逻辑 ---
// script.js

/**
 * (V3版 - 支持双保底系统) 检查并根据规则发放奖励
 * @param {boolean} wasTaskImportant - 刚刚完成的任务是否是重要的
 */
async function checkForReward(wasTaskImportant) {
    console.log(`任务完成，类型: ${wasTaskImportant ? '重要' : '非重要'}`);
    if (!currentUser) return;

    rewardDisplay.innerHTML = ''; // 清空上一次的反馈信息

    // --- 1. 获取并更新总任务计数器 ---
    const { data: profile, error: profileError } = await supabaseClient
        .from('profiles')
        .select('non_important_task_progress, task_completion_counter') // 同时获取两个计数器
        .eq('id', currentUser.id)
        .single();

    if (profileError) {
        console.error("获取用户进度失败:", profileError);
        return rewardDisplay.innerHTML = `<p class="feedback-message error">获取用户进度失败</p>`;
    }

    // 总任务计数器必定+1
    const newTotalTasks = profile.task_completion_counter + 1;
    await supabaseClient.from('profiles').update({ task_completion_counter: newTotalTasks }).eq('id', currentUser.id);
    updateLegendaryProgressUI(newTotalTasks); // 更新UI

    // --- 2. 检查是否触发“大保底”（最高优先级）---
    const LEGENDARY_PITY_THRESHOLD = 50;
    if (newTotalTasks >= LEGENDARY_PITY_THRESHOLD) {
        console.warn(`★★★★★ 大保底触发！总任务数: ${newTotalTasks}`);
        await grantLegendaryReward(); // 调用专门的传说奖励函数
        // 重置大保底计数器
        await supabaseClient.from('profiles').update({ task_completion_counter: 0 }).eq('id', currentUser.id);
        updateLegendaryProgressUI(0); // UI也重置
        return; // 大保底触发后，不再执行后续的常规奖励逻辑
    }

    // --- 3. 如果未触发大保底，则执行常规奖励逻辑 ---
    if (wasTaskImportant) {
        // 重要任务直接获得奖励
        await grantRandomReward("完成重要任务");
    } else {
        // 非重要任务，检查小保底进度
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
// script.js (添加在 grantRandomReward 函数的上方或下方)
/**
 * 更新“大保底”传说奖励的进度条UI
 * @param {number} current - 当前计数值
 */
function updateLegendaryProgressUI(current) {
    const max = 50;
    if (legendaryProgressBar && legendaryProgressText) {
        const percentage = Math.min((current / max) * 100, 100);
        legendaryProgressBar.style.width = `${percentage}%`;
        legendaryProgressText.textContent = `${current} / ${max}`;
    }
}
/**
 * 发放一个保底的“传说”级别奖励
 */
async function grantLegendaryReward() {
    console.log("正在发放传说保底奖励...");
    rewardDisplay.innerHTML = `<p>检测到里程碑达成！正在为您颁发传说级奖励...</p>`;

    try {
        // 1. 从奖池中筛选出所有“传说”物品
        const { data: legendaryRewards, error } = await supabaseClient
            .from('rewards')
            .select('id, name, image_url, rarity, type')
            .eq('rarity', '传说');

        if (error || !legendaryRewards || legendaryRewards.length === 0) {
            throw new Error("大保底触发，但传说奖池为空或获取失败！");
        }

        // 2. 从传说奖池中随机选一个
        const legendaryReward = legendaryRewards[Math.floor(Math.random() * legendaryRewards.length)];
        console.log(`传说保底获得: ${legendaryReward.name}`);

        // 3. 将奖励存入用户仓库
        await supabaseClient
            .from('user_inventory')
            .insert({ user_id: currentUser.id, reward_id: legendaryReward.id });

        // 4. ★★ 关键联动：获得传说物品后，也应该重置“防脸黑”的小保底计数器！ ★★
        await supabaseClient
            .from('profiles')
            .update({ pity_counter: 0 })
            .eq('id', currentUser.id);
        updatePityCounterUI(0); // 更新UI

        // 5. 在UI上用最华丽的方式展示奖励
        const rarityClass = `rarity-${legendaryReward.rarity.toLowerCase()}`;
        rewardDisplay.innerHTML = `
            <h3 style="color: #ff8c00; font-weight:bold;">★★ 里程碑达成 ★★</h3>
            <div class="reward-card ${rarityClass}">
                <img src="${legendaryReward.image_url}" alt="${legendaryReward.name}" />
                <h4>${legendaryReward.name}</h4>
                <p>类别: ${legendaryReward.type}</p>
                <p>稀有度: <span class="rarity-text">${legendaryReward.rarity}</span></p>
            </div>
        `;

        // 6. 刷新仓库显示
        await fetchInventory();

    } catch (error) {
        console.error('传说保底奖励发放流程出错:', error);
        rewardDisplay.innerHTML = `<p style="color:red;">哎呀，传说奖励发放出错了: ${error.message}</p>`;
    }
}

/**
 * (全新升级版) 发放一个随机奖励，内置“保底”机制
 * @param {string} reason - 获得奖励的原因
 */
async function grantRandomReward(reason) {
    console.log(`开始发放奖励，原因: ${reason}`);
    rewardDisplay.innerHTML = `<p>正在为你抽取奖励...</p>`;
    if (!currentUser) return console.error("用户未登录，无法发放奖励");

    // --- 1. 定义保底机制的常量 ---
    const PITY_THRESHOLD = 10; // 连续10次未出货，触发保底
    const HIGH_RARITY_CATEGORIES = ['稀有', '史诗', '传说']; // 定义哪些算“好东西”

    try {
        // --- 2. 获取用户当前的保底进度 ---
        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('pity_counter')
            .eq('id', currentUser.id)
            .single();

        if (profileError) throw new Error(`获取用户保底信息失败: ${profileError.message}`);

        let currentPity = profile.pity_counter;
        let randomReward;
        let isPityPull = false; // 标记本次是否是保底触发的

        // --- 3. 检查是否触发保底 ---
        if (currentPity >= PITY_THRESHOLD) {
            console.warn(`保底机制触发！当前计数: ${currentPity}`);
            isPityPull = true;

            // 从高稀有度奖池中随机抽取一个
            const { data: highRarityRewards, error: pityError } = await supabaseClient
                .from('rewards')
                .select('id, name, image_url, rarity, type')
                .in('rarity', HIGH_RARITY_CATEGORIES); // .in() 是个新技巧，用于查询多个值

            if (pityError || highRarityRewards.length === 0) {
                throw new Error("保底触发，但获取高稀有度物品失败！");
            }
            randomReward = highRarityRewards[Math.floor(Math.random() * highRarityRewards.length)];

        } else {
            // --- 4. 未触发保底，执行常规的加权随机抽奖 ---
            const { data: allRewards, error: rewardsError } = await supabaseClient
                .from('rewards')
                .select('id, name, image_url, rarity, type');

            if (rewardsError) throw rewardsError;
            if (allRewards.length === 0) throw new Error("奖励池是空的！");

            const weights = { '普通': 65, '稀有': 25, '史诗': 5, '传说': 1 };
            const weightedPool = [];
            allRewards.forEach(reward => {
                const weight = weights[reward.rarity] || 1;
                for (let i = 0; i < weight; i++) {
                    weightedPool.push(reward);
                }
            });
            randomReward = weightedPool[Math.floor(Math.random() * weightedPool.length)];
        }

        // --- 5. 根据本次抽奖结果，更新保底计数器 ---
        let newPityCounter;
        if (HIGH_RARITY_CATEGORIES.includes(randomReward.rarity)) {
            // 如果抽中了高稀有度物品，计数器清零
            console.log(`抽中高稀有度物品 [${randomReward.rarity}]，保底计数器清零。`);
            newPityCounter = 0;
        } else {
            // 如果没抽中，计数器+1
            newPityCounter = currentPity + 1;
            console.log(`未抽中高稀有度物品，保底计数器: ${newPityCounter}`);
        }

        // 将新的计数器更新到数据库
        await supabaseClient
            .from('profiles')
            .update({ pity_counter: newPityCounter })
            .eq('id', currentUser.id);


        // --- 6. 将奖励存入仓库并更新UI (与之前类似) ---
        console.log('恭喜！抽中了:', randomReward.name, `(稀有度: ${randomReward.rarity})`);

        await supabaseClient
            .from('user_inventory')
            .insert({ user_id: currentUser.id, reward_id: randomReward.id });

        const rarityClass = `rarity-${randomReward.rarity.toLowerCase()}`;

        // 如果是保底，显示特殊的提示
        const pityTitle = isPityPull ? `<h3>恭喜你获得! <span style="color: #ff8c00; font-weight:bold;">(触发保底)</span></h3>` : `<h3>恭喜你获得!</h3>`;

        rewardDisplay.innerHTML = `
            ${pityTitle}
            <div class="reward-card ${rarityClass}">
                <img src="${randomReward.image_url}" alt="${randomReward.name}" />
                <h4>${randomReward.name}</h4>
                <p>类别: ${randomReward.type}</p>
                <p>稀有度: <span class="rarity-text">${randomReward.rarity}</span></p>
            </div>
        `;

        await fetchInventory(); // 刷新仓库

        // (可选) 更新UI上的保底计数器显示，见第三步
        updatePityCounterUI(newPityCounter);

    } catch (error) {
        console.error('奖励发放流程出错:', error);
        rewardDisplay.innerHTML = `<p style="color:red;">哎呀，奖励发放出错了: ${error.message}</p>`;
    }
}
/**
 * 获取并显示用户的物品仓库
 */
async function fetchInventory() {
    if (!currentUser) return;
    inventoryDisplay.innerHTML = '加载中...';

    const { data, error } = await supabaseClient
        .from('user_inventory')
        .select(`rewards(id, name, image_url, type, rarity)`) // 也获取id，以备将来使用
        .eq('user_id', currentUser.id);

    if (error) {
        console.error('获取仓库失败:', error);
        return inventoryDisplay.innerHTML = '加载失败';
    }

    inventoryDisplay.innerHTML = '';
    if (data.length === 0) {
        inventoryDisplay.innerHTML = '<p>你的收藏还是空的，快去完成任务吧！</p>';
    } else {
        data.forEach(item => {
            const reward = item.rewards;
            if (!reward) return; // 安全检查，防止奖励已被删除的情况
            const rarityClass = `rarity-${reward.rarity.toLowerCase()}`;
            const itemDiv = document.createElement('div');
            itemDiv.className = `inventory-item ${rarityClass}`;
            itemDiv.title = `${reward.name}\n稀有度: ${reward.rarity}\n类别: ${reward.type}`;
            itemDiv.innerHTML = `
                <img src="${reward.image_url}" alt="${reward.name}" />
                <div class="item-name">${reward.name}</div>
            `;
            inventoryDisplay.appendChild(itemDiv);
        });
    }
}


// --- 5. 事件监听与程序入口 ---

// 绑定UI元素的点击事件
loginButton.addEventListener('click', handleLogin);
//logoutButton.addEventListener('click', () => supabaseClient.auth.signOut());
addTaskButton.addEventListener('click', handleAddTask);

// 为整个任务列表容器设置一个事件监听器（事件委托）
todolistContainer.addEventListener('click', (event) => {
    // 只响应对class为`complete-checkbox`的元素的点击
    if (event.target.classList.contains('complete-checkbox')) {
        const checkbox = event.target;
        checkbox.disabled = true; // 点击后立即禁用，防止重复触发
        const taskId = checkbox.dataset.taskId;
        const isImportant = checkbox.dataset.isImportant === 'true'; // 将字符串转为布尔值
        handleCompleteTask(taskId, isImportant);
    }
});

/**
 * === 最终的程序入口 ===
 * 这是整个脚本的“大脑”，它负责响应所有认证状态的变化。
 * 它会在页面加载、用户登录、用户退出时自动运行，并调用相应的函数来更新UI。
 */
supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log(`认证事件触发: ${event}`);

    // 逻辑非常简单：只要有 session，就视为登录成功；否则，视为未登录。
    if (session) {
        onLoginSuccess(session.user);
    } else {
        onLogout();
    }
});