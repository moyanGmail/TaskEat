// --- 1. 初始化与常量定义 ---

// Supabase 客户端初始化
const { createClient } = supabase;
const SUPABASE_URL = 'https://lqbtyhkvljyqpbtqanom.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxYnR5aGt2bGp5cXBidHFhbm9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzNzYyNjIsImV4cCI6MjA2NDk1MjI2Mn0.YiloY00GzPTB2A-D1ysfhIGBUhsZBtm4mwvB9SvNUzg';
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log('Supabase客户端已初始化');

// 全局变量
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


// --- 2. 用户认证逻辑 ---

/**
 * 处理登录按钮点击
 */
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

/**
 * 用户成功登录后要执行的所有操作
 * @param {object} user - Supabase用户对象
 */
function onLoginSuccess(user) {
    currentUser = user;
    console.log("登录成功, 用户:", currentUser.id);
    authSection.style.display = 'none';
    gameSection.style.display = 'block';

    // 加载用户的游戏数据
    fetchInventory();
    fetchAndRenderTodos();
}

/**
 * 用户未登录或退出时要执行的操作
 */
function onLogout() {
    currentUser = null;
    console.log("用户未登录或已退出。");
    authSection.style.display = 'block';
    gameSection.style.display = 'none';
}

/**
 * 检查当前是否存在有效的用户会话
 */
async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        onLoginSuccess(session.user);
    } else {
        onLogout();
    }
}


// --- 3. Todolist 核心功能 ---

/**
 * 获取并渲染当前用户的待办任务
 */
async function fetchAndRenderTodos() {
    if (!currentUser) return;
    todolistContainer.innerHTML = '<li>加载中...</li>';

    const { data: todos, error } = await supabaseClient
        .from('todos')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('is_complete', false)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('获取任务列表失败:', error);
        return todolistContainer.innerHTML = '<li>加载任务失败</li>';
    }

    todolistContainer.innerHTML = '';
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
 * 处理添加新任务
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
        fetchAndRenderTodos();
    }
}

/**
 * 处理完成任务
 * @param {string} taskId - 任务的ID
 * @param {boolean} isImportant - 任务是否重要
 */
async function handleCompleteTask(taskId, isImportant) {
    // 1. 在数据库中将任务标记为已完成
    const { error } = await supabaseClient
        .from('todos')
        .update({ is_complete: true })
        .eq('id', taskId);

    if (error) return console.error('更新任务状态失败:', error);

    // 2. 重新渲染UI (移除已完成项)
    fetchAndRenderTodos();

    // 3. 检查是否应该获得奖励
    checkForReward(isImportant);
}


// --- 4. 游戏奖励逻辑 ---

/**
 * 检查并根据规则发放奖励
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
        // 1. 获取用户当前的进度
        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('non_important_task_progress')
            .eq('id', currentUser.id)
            .single();

        if (profileError) return console.error("获取用户进度失败:", profileError);

        const newProgress = profile.non_important_task_progress + 1;
        console.log(`非重要任务进度: ${newProgress}/3`);

        if (newProgress >= 3) {
            console.log("非重要任务进度达成，发放奖励并重置！");
            await grantRandomReward("完成3个普通任务");
            // 重置计数器为0
            await supabaseClient.from('profiles').update({ non_important_task_progress: 0 }).eq('id', currentUser.id);
        } else {
            // 未达到3个，只更新计数器
            await supabaseClient.from('profiles').update({ non_important_task_progress: newProgress }).eq('id', currentUser.id);
        }
    }
}

/**
 * (重构后) 发放一个随机奖励
 * @param {string} reason - 获得奖励的原因
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

        const weights = { '普通': 70, '稀有': 25, '史诗': 5, '传说': 1 };
        const weightedPool = [];
        allRewards.forEach(reward => {
            const weight = weights[reward.rarity] || 1;
            for (let i = 0; i < weight; i++) {
                weightedPool.push(reward);
            }
        });
        const randomReward = weightedPool[Math.floor(Math.random() * weightedPool.length)];

        console.log('恭喜！抽中了:', randomReward.name, `(稀有度: ${randomReward.rarity})`);

        const { error: inventoryError } = await supabaseClient
            .from('user_inventory')
            .insert({ user_id: currentUser.id, reward_id: randomReward.id });

        if (inventoryError) throw inventoryError;

        const rarityClass = `rarity-${randomReward.rarity.toLowerCase()}`;
        rewardDisplay.innerHTML = `
            <h3>恭喜你获得! (${reason})</h3>
            <div class="reward-card ${rarityClass}">
                <img src="${randomReward.image_url}" alt="${randomReward.name}" />
                <h4>${randomReward.name}</h4>
                <p>类别: ${randomReward.type}</p>
                <p>稀有度: <span class="rarity-text">${randomReward.rarity}</span></p>
            </div>
        `;

        // 刷新仓库显示
        await fetchInventory();

    } catch (error) {
        console.error('奖励发放流程出错:', error);
        rewardDisplay.innerHTML = `<p style="color:red;">哎呀，奖励发放出错了: ${error.message}</p>`;
    }
}

/**
 * 获取并显示用户的物品仓库 (这个函数保持不变, 但需要确保它能被调用)
 */
async function fetchInventory() {
    if (!currentUser) return;
    inventoryDisplay.innerHTML = '加载中...';

    const { data, error } = await supabaseClient
        .from('user_inventory')
        .select(`rewards(name, image_url, type, rarity)`)
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
            if (!reward) return;
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

// 绑定认证相关事件
loginButton.addEventListener('click', handleLogin);
logoutButton.addEventListener('click', () => supabaseClient.auth.signOut());

// 绑定Todolist相关事件
addTaskButton.addEventListener('click', handleAddTask);
todolistContainer.addEventListener('click', (event) => {
    if (event.target.classList.contains('complete-checkbox')) {
        const checkbox = event.target;
        checkbox.disabled = true; // 防止重复点击
        const taskId = checkbox.dataset.taskId;
        const isImportant = checkbox.dataset.isImportant === 'true';
        handleCompleteTask(taskId, isImportant);
    }
});

// 监听认证状态变化 (用于实时响应)
supabaseClient.auth.onAuthStateChange((_event, session) => {
    // 简化处理，无论发生什么事件，都以`checkSession`为准来刷新状态
    // 这可以避免在魔法链接返回时出现状态不一致的问题
    if (_event === 'SIGNED_IN' || _event === 'SIGNED_OUT' || _event === 'INITIAL_SESSION') {
         checkSession();
    }
});

// 真正的程序入口：页面加载后，立即执行会话检查
checkSession();