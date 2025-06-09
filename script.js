// 简化版“照妖镜”测试脚本
console.log("简化版测试脚本已加载。");

// 尝试获取排行榜列表元素
const leaderboardList = document.getElementById('leaderboard-list');

// 检查是否找到了
if (leaderboardList) {
  console.log("太棒了！成功在HTML中找到了 ID 为 'leaderboard-list' 的元素！");
  leaderboardList.innerHTML = "<li>测试成功！JS可以操作我！</li>";
} else {
  console.error("致命错误：在HTML中找不到 ID 为 'leaderboard-list' 的元素！请立刻检查你的 index.html 文件，确保有 <ol id='leaderboard-list'></ol> 这一行！");
}