// ===================================================================================
// == 像素风Todolist打卡小游戏 - 完整版脚本
// ===================================================================================

// --- 1. 初始化与常量定义 ---

// Supabase 客户端初始化
const { createClient } = supabase;
const SUPABASE_URL = 'https://lqbtyhkvljyqpbtqanom.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxYnR5aGt2bGp5cXBidHFhbm9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzNzYyNjIsImV4cCI6MjA2NDk1MjI2Mn0.YiloY00GzPTB2A-D1ysfhIGBUhsZBtm4mwvB9SvNUzg';
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log('Supabase客户端已初始化');

// 全局变量，用于存储当前登录用户的信息
let currentUser = null;

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
function onLoginSuccess(user) {
    // 如果当前用户已经是这个user，就没必要重复加载，防止UI闪烁
    if (currentUser && currentUser.id === user.id) return;

    currentUser = user;
    console.log("登录成功, 更新UI. 用户:", currentUser.id);

    // 切换界面显示
    authSection.style.display = 'none';
    gameSection.style.display = 'block';

    // 加载该用户的游戏数据
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

/**
 * 检查是否满足奖励条件，并根据规则发放奖励
 * @param {boolean} wasTaskImportant - 刚刚完成的任务是否是重要的
 */
async function checkForReward(wasTaskImportant) {
    console.log(`任务完成，类型: ${wasTaskImportant ? '重要' : '非重要'}`);

    if (wasTaskImportant) {
        // 规则1: 完成1个重要任务，直接获得奖励
        console.log("重要任务完成，准备发放奖励！");
        await grantRandomReward("完成重要任务");
    } else {
        // 规则2: 完成3个非重要任务，获得奖励
        // 1. 获取用户当前的普通任务进度
        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('non_important_task_progress')
            .eq('id', currentUser.id)
            .single(); // .single()确保只返回一个对象，而不是数组

        if (profileError) return console.error("获取用户进度失败:", profileError);

        const newProgress = profile.non_important_task_progress + 1;
        console.log(`非重要任务进度: ${newProgress}/3`);

        if (newProgress >= 3) {
            // 进度达成，发放奖励并重置计数器
            console.log("非重要任务进度达成，发放奖励并重置！");
            await grantRandomReward("完成3个普通任务");
            await supabaseClient.from('profiles').update({ non_important_task_progress: 0 }).eq('id', currentUser.id);
        } else {
            // 进度未达成，只更新计数器
            await supabaseClient.from('profiles').update({ non_important_task_progress: newProgress }).eq('id', currentUser.id);
        }
    }
}

/**
 * 发放一个随机奖励（包含加权随机算法）
 * @param {string} reason - 获得奖励的原因，用于UI显示
 */
async function grantRandomReward(reason) {
    console.log(`开始发放奖励，原因: ${reason}`);
    rewardDisplay.innerHTML = `<p>正在为你抽取奖励...</p>`;

    try {
        const { data: allRewards, error: rewardsError } = await supabaseClient
            .from('rewards')
            .select('id, name, image_url, rarity, type');

        if (rewardsError) throw rewardsError;
        if (allRewards.length === 0) throw new Error("奖励池是空的！");

        // 定义不同稀有度的权重
        const weights = { '普通': 70, '稀有': 25, '史诗': 5, '传说': 1 };

        // 创建加权抽奖池
        const weightedPool = [];
        allRewards.forEach(reward => {
            const weight = weights[reward.rarity] || 1; // 如果物品稀有度未定义权重，默认为1
            for (let i = 0; i < weight; i++) {
                weightedPool.push(reward);
            }
        });

        // 从加权池中随机抽取一个奖励
        const randomReward = weightedPool[Math.floor(Math.random() * weightedPool.length)];

        console.log('恭喜！抽中了:', randomReward.name, `(稀有度: ${randomReward.rarity})`);

        // 将获得的奖励存入用户物品栏
        const { error: inventoryError } = await supabaseClient
            .from('user_inventory')
            .insert({ user_id: currentUser.id, reward_id: randomReward.id });

        if (inventoryError) throw inventoryError;

        // 在UI上显示获得的奖励
        const rarityClass = `rarity-${randomReward.rarity.toLowerCase()}`;
        rewardDisplay.innerHTML = `
            <h3>恭喜你获得! <span style="font-weight:normal; font-size: 0.8em;">(${reason})</span></h3>
            <div class="reward-card ${rarityClass}">
                <img src="${randomReward.image_url}" alt="${randomReward.name}" />
                <h4>${randomReward.name}</h4>
                <p>类别: ${randomReward.type}</p>
                <p>稀有度: <span class="rarity-text">${randomReward.rarity}</span></p>
            </div>
        `;

        // 刷新仓库显示，以包含新获得的物品
        await fetchInventory();

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