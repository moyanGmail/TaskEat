// script.js

// --- 4.1 连接到Supabase ---
// 从官方CDN库中解构出 createClient 方法
const { createClient } = supabase;

// 这两个关键信息需要你从自己的Supabase项目里复制过来
// 路径：进入你的项目 -> 左下角“Project Settings” -> “API”
const SUPABASE_URL = 'https://lqbtyhkvljyqpbtqanom.supabase.co'; // 把这里换成你的URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxYnR5aGt2bGp5cXBidHFhbm9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzNzYyNjIsImV4cCI6MjA2NDk1MjI2Mn0.YiloY00GzPTB2A-D1ysfhIGBUhsZBtm4mwvB9SvNUzg'; // 把这里换成你的Anon (public) Key

// 创建一个Supabase客户端实例，我们之后所有操作都通过它进行
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('Supabase客户端已初始化:', supabaseClient);

/**
 * 检查当前是否存在有效的用户会话。
 * 这是实现“记住我”功能的关键。
 */
async function checkSession() {
    // getSession() 会从 localStorage 中获取会话信息
    const { data: { session }, error } = await supabaseClient.auth.getSession();

    if (error) {
        console.error("获取会话失败:", error);
        return;
    }

    if (session) {
        // 如果找到了会话，说明用户是“已登录”状态
        console.log("找到有效会话，用户已登录:", session.user);

        // UI操作：隐藏登录区，显示游戏区
        authSection.style.display = 'none';
        gameSection.style.display = 'block';

        // 加载该用户的游戏数据
        loadGameData(session.user);
    } else {
        // 如果没找到会话，说明用户是“未登录”状态
        console.log("未找到有效会话，请登录。");

        // UI操作：显示登录区，隐藏游戏区
        authSection.style.display = 'block';
        gameSection.style.display = 'none';
    }
}

// --- 4.2 用户认证 ---

// 获取HTML元素
const authSection = document.getElementById('auth-section');
const gameSection = document.getElementById('game-section');
const loginButton = document.getElementById('login-button');
const emailInput = document.getElementById('email-input');

// 监听登录按钮点击
loginButton.addEventListener('click', async () => {
    const email = emailInput.value;
    if (!email) {
        alert('请输入邮箱地址！');
        return;
    }

    try {
        // 这是Supabase的魔法！调用这个函数就会自动发送登录邮件
        // 修改后的代码
        const { error } = await supabaseClient.auth.signInWithOtp({
          email: email, // 用户的邮箱
          options: {
            // 明确告诉Supabase，在用户点击邮件链接后，应该跳转到这个URL
            emailRedirectTo: 'https://task-eat.vercel.app',
          }
        });
        if (error) throw error;
        alert('登录链接已发送至您的邮箱，发件人为supabase，请查收~');
    } catch (error) {
        console.error('登录失败:', error);
        alert(`登录失败: ${error.message}`);
    }
});


// 监听用户的认证状态变化 (登录、退出)
// 这是整个认证流程中最核心的部分！
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
        // 用户成功登录！
        console.log('用户已登录:', session.user);
        authSection.style.display = 'none'; // 隐藏登录区域
        gameSection.style.display = 'block';  // 显示游戏区域

        // 登录成功后，立即加载游戏数据
        loadGameData(session.user);

    } else if (event === 'SIGNED_OUT') {
        // 用户退出登录
        authSection.style.display = 'block'; // 显示登录区域
        gameSection.style.display = 'none';  // 隐藏游戏区域
    }
});

const logoutButton = document.getElementById('logout-button');
logoutButton.addEventListener('click', () => supabaseClient.auth.signOut());

/**
 * 检查当前是否存在有效的用户会话 (上面第二步添加的函数)
 */
async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        console.log("找到有效会话，用户已登录:", session.user);
        authSection.style.display = 'none';
        gameSection.style.display = 'block';
        loadGameData(session.user);
    } else {
        console.log("未找到有效会话，请登录。");
        authSection.style.display = 'block';
        gameSection.style.display = 'none';
    }
}

// 监听用户的认证状态变化 (这个函数也几乎不变)
// 它现在主要负责处理“刚刚发生”的登录/退出事件
supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log(`认证事件: ${event}`, session);
    // 当用户通过魔法链接刚登录，或者刚退出时，重新检查会话状态来更新UI
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        checkSession();
    }
});


// === 脚本执行入口 ===
// 在所有函数都定义好之后，在脚本的最后，立即调用 checkSession
checkSession();

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