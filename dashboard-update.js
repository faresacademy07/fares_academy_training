// New renderDashboard function for admin employee view
function renderDashboard() {
    const container = document.getElementById('monthlySummary');
    
    if (currentUser.role !== 'admin') {
        // Regular user: show monthly commission
        const monthlyData = {};
        allSubscribers.forEach(subscriber => {
            const month = subscriber.month;
            if (!monthlyData[month]) {
                monthlyData[month] = 0;
            }
            const completedSessions = (subscriber.sessionDates || []).filter(d => d).length;
            const calc = calculateCommission(subscriber.sessions, completedSessions);
            monthlyData[month] += parseFloat(calc.commission);
        });
        
        if (Object.keys(monthlyData).length === 0) {
            container.innerHTML = '<p class="empty-message">لا توجد بيانات</p>';
            return;
        }
        container.innerHTML = Object.entries(monthlyData).map(([month, commission]) => `
            <div class="month-card">
                <div class="month-name">${month}</div>
                <div class="month-commission">${commission.toFixed(2)}</div>
                <div class="month-commission-label">ريال سعودي</div>
            </div>`).join('');
    } else {
        // Admin: show employees with subscribers
        const employeeData = {};
        allSubscribers.forEach(subscriber => {
            const empName = subscriber.userName || 'Unknown';
            if (!employeeData[empName]) {
                employeeData[empName] = [];
            }
            employeeData[empName].push(subscriber);
        });
        
        if (Object.keys(employeeData).length === 0) {
            container.innerHTML = '<p class="empty-message">لا توجد بيانات</p>';
            return;
        }
        
        container.innerHTML = Object.entries(employeeData).map(([empName, subs]) => {
            let totalComm = 0;
            const subsList = subs.map(s => {
                const completed = (s.sessionDates || []).filter(d => d).length;
                const calc = calculateCommission(s.sessions, completed);
                totalComm += parseFloat(calc.commission);
                return `
                    <div style="padding: 10px; background: white; border-radius: 5px; margin-bottom: 8px; border-left: 3px solid var(--secondary);">
                        <div style="font-weight: 600; color: var(--primary);">${s.name}</div>
                        <div style="font-size: 12px; color: #666; margin-top: 3px;">جلسات: ${completed}/${s.sessions}</div>
                        <div style="font-size: 12px; color: var(--secondary); font-weight: 600;">عمولة: ${calc.commission} ريال</div>
                    </div>
                `;
            }).join('');
            return `
                <div style="background: linear-gradient(135deg, var(--primary), #003d99); color: white; padding: 20px; border-radius: 8px; margin-bottom: 15px;">
                    <div style="font-size: 18px; font-weight: bold; margin-bottom: 15px; border-bottom: 2px solid var(--secondary); padding-bottom: 10px;">${empName}</div>
                    <div style="margin-bottom: 15px;">${subsList}</div>
                    <div style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 5px; text-align: center;">
                        <div style="font-size: 12px;">إجمالي العمولة</div>
                        <div style="font-size: 24px; font-weight: bold; color: var(--secondary);">${totalComm.toFixed(2)} ريال</div>
                    </div>
                </div>
            `;
        }).join('');
    }
}
