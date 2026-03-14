#!/bin/bash

# AI-EDU 测试环境准备脚本
# 准备测试数据和环境验证

echo "🔧 AI-EDU 测试环境准备"
echo "======================="

# 1. 检查服务器状态
echo "✓ 检查服务器状态..."
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health)

if [ "$FRONTEND_STATUS" = "200" ]; then
    echo "  ✅ 前端服务器 (localhost:3000) 正常运行"
else
    echo "  ❌ 前端服务器异常，状态码: $FRONTEND_STATUS"
fi

if [ "$BACKEND_STATUS" = "200" ]; then
    echo "  ✅ 后端服务器 (localhost:3001) 正常运行"
else
    echo "  ❌ 后端服务器异常，状态码: $BACKEND_STATUS"
fi

# 2. 准备测试用户数据
echo "✓ 准备测试用户数据..."

# 测试用户凭据
TEST_PARENT_EMAIL="test-parent@edulens.com"
TEST_PARENT_PASSWORD="TestPass123!"
TEST_STUDENT_USERNAME="test-student-001"
TEST_STUDENT_PASSWORD="StudentPass123!"

echo "  📋 测试凭据准备完成："
echo "     父母账户: $TEST_PARENT_EMAIL / $TEST_PARENT_PASSWORD"
echo "     学生账户: $TEST_STUDENT_USERNAME / $TEST_STUDENT_PASSWORD"

# 3. 检查新功能文件状态
echo "✓ 检查新功能开发进度..."

# 检查前端错误分析页面
if [ -f "/home/ubuntu/workspace/AI-EDU/edulens-frontend/src/app/parent/students/[studentId]/error-analysis/page.tsx" ]; then
    echo "  ✅ 错误分析页面已创建"
else
    echo "  ❌ 错误分析页面未找到"
fi

# 检查分析组件文件夹
if [ -d "/home/ubuntu/workspace/AI-EDU/edulens-frontend/src/components/analytics" ]; then
    COMPONENT_COUNT=$(ls -1 /home/ubuntu/workspace/AI-EDU/edulens-frontend/src/components/analytics/*.tsx 2>/dev/null | wc -l)
    echo "  ✅ 分析组件文件夹存在，包含 $COMPONENT_COUNT 个组件"
else
    echo "  ⚠️  分析组件文件夹不存在，可能仍在开发中"
fi

# 检查后端API处理器
if [ -f "/home/ubuntu/workspace/AI-EDU/edulens-backend/services/profile-engine/src/handlers/get_error_patterns_aggregate.py" ]; then
    echo "  ✅ 错误模式聚合API已创建"
else
    echo "  ❌ 错误模式聚合API未找到"
fi

if [ -f "/home/ubuntu/workspace/AI-EDU/edulens-backend/services/profile-engine/src/handlers/get_error_patterns_trends.py" ]; then
    echo "  ✅ 错误趋势分析API已创建"
else
    echo "  ❌ 错误趋势分析API未找到"
fi

# 4. 创建测试场景清单
echo "✓ 生成测试场景清单..."

cat > /home/ubuntu/workspace/AI-EDU/test-scenarios.md << EOF
# 🧪 AI-EDU 测试场景清单

## 🎯 新功能测试 - 综合错误模式分析仪表盘

### API 端点测试
- [ ] GET /api/profile/{studentId}/error-patterns/aggregate
- [ ] GET /api/profile/{studentId}/error-patterns/trends
- [ ] 参数验证测试 (days, period等)
- [ ] 错误处理测试 (无效studentId等)

### 前端页面测试
- [ ] 错误分析页面渲染测试
- [ ] 时间范围选择器测试
- [ ] 数据刷新功能测试
- [ ] 响应式布局测试

### 组件功能测试
- [ ] ErrorPatternsOverview 组件
- [ ] ErrorTimelineAnalysis 组件
- [ ] SkillErrorCorrelation 组件
- [ ] ActionableInsights 组件

### 数据可视化测试
- [ ] 错误趋势图表渲染
- [ ] 技能-错误相关性图表
- [ ] 交互性测试 (hover, click等)
- [ ] 数据更新动画测试

## 🔄 集成测试

### 导航流程测试
- [ ] 父母仪表盘 → 学生分析 → 错误分析页面
- [ ] 面包屑导航测试
- [ ] 返回功能测试

### 数据一致性测试
- [ ] 错误计数与其他页面一致
- [ ] 学生信息同步
- [ ] 时间范围数据准确性

## 🏃‍♂️ 端到端场景测试

### 完整用户工作流
1. 父母登录 → 选择学生 → 查看错误分析
2. 学生完成测试 → 生成错误数据 → 父母查看分析结果
3. 错误模式识别 → 获取AI建议 → 制定学习计划

## 🔙 回归测试

### 现有功能验证
- [ ] 认证系统正常
- [ ] 学生测试流程
- [ ] 父母AI聊天功能
- [ ] 现有分析页面
- [ ] 性能无明显降低
EOF

echo "  📝 测试场景清单已生成: /home/ubuntu/workspace/AI-EDU/test-scenarios.md"

# 5. 系统资源检查
echo "✓ 系统资源检查..."
MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.1f%%", $3/$2 * 100.0}')
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{printf "%.1f%%", 100 - $1}')

echo "  💻 内存使用率: $MEMORY_USAGE"
echo "  🔄 CPU使用率: $CPU_USAGE"

echo ""
echo "🎉 测试环境准备完成！"
echo "💡 等待开发完成后，运行全面测试..."