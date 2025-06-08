// 确保这些元素获取代码在最前面
const authSection = document.getElementById('auth-section');
const gameSection = document.getElementById('game-section');
const loginButton = document.getElementById('login-button');
const emailInput = document.getElementById('email-input');

// --- 函数定义区 ---

/**
 * 处理登录按钮点击
 */
async function handleLogin() {
    const email = emailInput.value;
    if (!email) {
        alert('请输入邮箱地址！');
        return;
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
 * 更新UI并加载游戏数据
 * @param {object} user - Supabase用户对象
 */
function onLoginSuccess(user) {
    console.log("登录成功，更新UI并加载数据 for user:", user.id);
    authSection.style.display = 'none';
    gameSection.style.display = 'block';
    loadGameData(user); // 这是你已有的加载游戏数据的函数
}

/**
 * 处理未登录状态
 */
function onLogout() {
    console.log("用户未登录或已退出，显示登录界面。");
    authSection.style.display = 'block';
    gameSection.style.display = 'none';
}

/**
 * 检查当前会话状态
 */
async function checkSession() {
    console.log("1. 开始检查会话...");
    const { data: { session } } = await supabaseClient.auth.getSession();
    console.log("2. getSession() 调用完毕，获取到的 session:", session);

    if (session) {
        onLoginSuccess(session.user);
    } else {
        onLogout();
    }
}

// --- 事件监听与执行区 ---

// 绑定登录按钮事件
loginButton.addEventListener('click', handleLogin);

// 监听认证状态变化 (处理实时登录/退出)
supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log(`认证状态发生变化: ${event}`);
    // 这个监听器现在很简单，它只在状态明确改变时触发UI更新
    // 主要的启动逻辑由下面的 checkSession() 完成
    if (event === 'SIGNED_IN') {
        onLoginSuccess(session.user);
    } else if (event === 'SIGNED_OUT') {
        onLogout();
    }
});

// === 脚本执行入口 ===
// 页面加载后，立即执行会话检查
checkSession();

const logoutButton = document.getElementById('logout-button');
logoutButton.addEventListener('click', () => supabaseClient.auth.signOut());

// --- 4.1 连接到Supabase ---
// 从官方CDN库中解构出 createClient 方法
const { createClient } = supabase;

const SUPABASE_URL = 'https://lqbtyhkvljyqpbtqanom.supabase.co'; // 把这里换成你的URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxYnR5aGt2bGp5cXBidHFhbm9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzNzYyNjIsImV4cCI6MjA2NDk1MjI2Mn0.YiloY00GzPTB2A-D1ysfhIGBUhsZBtm4mwvB9SvNUzg'; // 把这里换成你的Anon (public) Key

// 创建一个Supabase客户端实例，我们之后所有操作都通过它进行
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('Supabase客户端已初始化:', supabaseClient);


// --- 4.3 核心游戏循环 ---

const checkInButton = document.getElementById('check-in-button');
const rewardDisplay = document.getElementById('reward-display');
const inventoryDisplay = document.getElementById('inventory-display');
let currentUser = null; // 用一个全局变量存储当前用户信息

// 主函数：加载所有游戏数据
async function loadGameData(user) {
    currentUser = user; // 保存当前用户信息
    checkInButton.disabled = false; // 确保按钮可用
    rewardDisplay.innerHTML = ''; // 清空上次的奖励显示

    await checkDailyStatus(); // 检查今天是否已打卡
    await fetchInventory();   // 加载并显示仓库
}

// 函数1: 检查今天是否已打卡
async function checkDailyStatus() {
    const today = new Date().toISOString().split('T')[0]; // 获取 YYYY-MM-DD 格式的今天日期

    const { data, error } = await supabaseClient
        .from('check_in_logs')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('date', today);

    if (error) {
        console.error('查询打卡记录失败:', error);
        return;
    }

    if (data.length > 0) {
        checkInButton.disabled = true;
        checkInButton.textContent = '今天已打卡';
        console.log('用户今天已经打过卡了。');
    }
}

// 函数2: 获取并显示仓库
async function fetchInventory() {
    inventoryDisplay.innerHTML = '加载中...'; // 提示用户

    // Supabase的魔法：通过外键关系，直接从user_inventory表里把rewards表的信息也查出来！
    const { data, error } = await supabaseClient
        .from('user_inventory')
        .select(`
            rewards (
                name,
                image_url,
                type,
                rarity
            )
        `)
        .eq('user_id', currentUser.id);

    if (error) {
        console.error('获取仓库失败:', error);
        inventoryDisplay.innerHTML = '加载失败';
        return;
    }

    inventoryDisplay.innerHTML = ''; // 清空加载提示
    if (data.length === 0) {
        inventoryDisplay.innerHTML = '<p>你的收藏还是空的，快来打卡吧！</p>';
    } else {
        data.forEach(item => {
            // item 的结构现在是 { rewards: { name: '...', image_url: '...', rarity: '...', type: '...' } }
                const reward = item.rewards;
                if (!reward) return; // 安全检查

                const rarityClass = `rarity-${reward.rarity.toLowerCase()}`;

                const itemDiv = document.createElement('div');
                itemDiv.className = `inventory-item ${rarityClass}`; // 给每个物品容器加上稀有度类
                itemDiv.title = `${reward.name}\n稀有度: ${reward.rarity}\n类别: ${reward.type}`; // 鼠标悬浮提示
                itemDiv.innerHTML = `
                    <img src="${reward.image_url}" alt="${reward.name}" />
                    <div class="item-name">${reward.name}</div>
                `;

                inventoryDisplay.appendChild(itemDiv);
        });
    }
}

// 【打卡按钮】的核心逻辑
checkInButton.addEventListener('click', async () => {
    if (!currentUser) return; // 安全检查

    checkInButton.disabled = true; // 防止重复点击
    checkInButton.textContent = '开箱中...';

    try {
        // script.js
        // 步骤1: 获取所有奖励的完整信息，包括稀有度！
        const { data: allRewards, error: rewardsError } = await supabaseClient
            .from('rewards')
            .select('id, name, image_url, rarity, type'); // <<<<<<< 修改这里，获取新字段

        if (rewardsError) throw rewardsError;
        if (allRewards.length === 0) throw new Error("奖励池是空的！");

        // 步骤1.5: 实现加权随机算法
        const weights = {
            '普通': 70, // 70% 的权重
            '稀有': 25, // 25% 的权重
            '史诗': 5,  // 5% 的权重
            '传说': 0.1 // 0.1% 的权重（可以先不放这个稀有度的物品）
        };

        const weightedPool = [];
        allRewards.forEach(reward => {
            // 根据权重，决定一个物品在“抽奖池”里应该放多少份
            const weight = weights[reward.rarity] || 1; // 如果没有定义权重，默认为1
            for (let i = 0; i < weight; i++) {
                weightedPool.push(reward);
            }
        });

        // 从加权后的大池子里随机抽一个
        const randomReward = weightedPool[Math.floor(Math.random() * weightedPool.length)];

        console.log('恭喜！抽中了:', randomReward.name, `(稀有度: ${randomReward.rarity})`);

        // 步骤2: 将奖励记录到用户仓库 (user_inventory)
        const { error: inventoryError } = await supabaseClient
            .from('user_inventory')
            .insert({ user_id: currentUser.id, reward_id: randomReward.id });

        if (inventoryError) throw inventoryError;

        // 步骤3: 记录今天的打卡 (check_in_logs)
        const today = new Date().toISOString().split('T')[0];
        const { error: logError } = await supabaseClient
            .from('check_in_logs')
            .insert({ user_id: currentUser.id, date: today });

        if (logError) throw logError;

        // 步骤4: 更新UI界面
        // ... 在 try-catch 块中

        // 为了根据稀有度显示不同颜色，我们先定义一个简单的CSS类名
        const rarityClass = `rarity-${randomReward.rarity.toLowerCase()}`; // e.g., rarity-普通, rarity-史诗

        rewardDisplay.innerHTML = `
            <h3>恭喜你获得!</h3>
            <div class="reward-card ${rarityClass}">
                <img src="${randomReward.image_url}" alt="${randomReward.name}" />
                <h4>${randomReward.name}</h4>
                <p>类别: ${randomReward.type}</p>
                <p>稀有度: <span class="rarity-text">${randomReward.rarity}</span></p>
            </div>
        `;
        checkInButton.textContent = '今天已打卡';

        // 步骤5: 刷新仓库显示
        await fetchInventory();

    } catch (error) {
        console.error('打卡流程出错:', error);
        rewardDisplay.innerHTML = `<p style="color:red;">哎呀，出错了: ${error.message}</p>`;
        checkInButton.disabled = false; // 让用户可以重试
        checkInButton.textContent = '今天我完成了！(重试)';
    }
});