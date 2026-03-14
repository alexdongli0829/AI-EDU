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
