# ---------------------------------------------------------
# TASK 7: SALES ANALYTICS DASHBOARD
# ---------------------------------------------------------
import streamlit as st
import pandas as pd
import json
import os
import plotly.express as px

# CONFIG
LEADS_FILE = os.path.join(os.path.dirname(__file__), '../processed_leads/clean_leads.json')

st.set_page_config(page_title="AI Sales Command Center", layout="wide")

# 1. LOAD DATA
def load_data():
    if not os.path.exists(LEADS_FILE):
        return []
    # FIX: Explicitly use utf-8 encoding to prevent Windows charmap errors
    with open(LEADS_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

data = load_data()

# 2. HEADER
st.title(" AI Sales Conversion System")
st.markdown("---")

if not data:
    st.error("No data found. Run the pipeline first!")
    st.stop()

# Convert JSON to Pandas DataFrame for easy math
df = pd.DataFrame(data)

# 3. KEY METRICS (KPIs)
col1, col2, col3, col4 = st.columns(4)

total_leads = len(df)
emails_sent = len(df[df['stage'] > 0]) if 'stage' in df.columns else 0
calls_made = len(df[df['status'] == 'CALLED']) + len(df[df['status'] == 'INTERESTED'])
hot_leads = len(df[df['score'] >= 50]) if 'score' in df.columns else 0

col1.metric("Total Leads", total_leads)
col2.metric("Emails Sent", emails_sent)
col3.metric("Calls Completed", calls_made)
col4.metric("🔥 Hot Leads", hot_leads)

st.markdown("---")

# 4. CHANNEL RESPONSE ANALYSIS (New Section)
st.subheader("📡 Channel Response Breakdown")
tab1, tab2, tab3 = st.tabs(["📧 Email Intelligence", "📞 Voice Call Outcomes", "💬 WhatsApp/SMS Replies"])

with tab1:
    c1, c2 = st.columns(2)
    with c1:
        if 'opened' in df.columns and 'clicked' in df.columns:
            e_sent = len(df[df['stage'] > 0]) if 'stage' in df.columns else 0
            e_open = len(df[df['opened'] == True])
            e_click = len(df[df['clicked'] == True])
            
            metrics_df = pd.DataFrame({
                'Action': ['Sent', 'Opened', 'Clicked'],
                'Count': [e_sent, e_open, e_click]
            })
            fig_email = px.bar(metrics_df, x='Action', y='Count', title="Email Funnel", color='Action')
            st.plotly_chart(fig_email, use_container_width=True)
        else:
            st.info("No email tracking data available yet.")
    with c2:
        st.write("Detailed Email Activity")
        if 'opened' in df.columns:
            st.dataframe(df[df['opened'] == True][['name', 'email', 'last_open_time']], use_container_width=True)

with tab2:
    c1, c2 = st.columns(2)
    with c1:
        if 'last_response_digit' in df.columns:
            # Filter only leads who pressed a digit
            voice_df = df[df['last_response_digit'].notna()]
            if not voice_df.empty:
                # Map 1, 2, 3 to text meanings
                voice_counts = voice_df['last_response_digit'].map({
                    '1': 'Interested (1)', 
                    '2': 'Call Later (2)', 
                    '3': 'Not Interested (3)'
                }).value_counts().reset_index()
                voice_counts.columns = ['Response', 'Count']
                
                fig_voice = px.pie(voice_counts, values='Count', names='Response', title="User Keypress Distribution", hole=0.4)
                st.plotly_chart(fig_voice, use_container_width=True)
            else:
                st.info("No voice inputs received yet.")
        else:
            st.info("No voice call data available yet.")
    with c2:
        if 'last_response_digit' in df.columns:
            st.write("Call Logs")
            st.dataframe(df[df['last_response_digit'].notna()][['name', 'phone', 'last_response_digit', 'status']], use_container_width=True)

with tab3:
    c1, c2 = st.columns(2)
    with c1:
        if 'last_reply' in df.columns:
            reply_df = df[df['last_reply'].notna()]
            if not reply_df.empty:
                reply_counts = reply_df['status'].value_counts().reset_index()
                reply_counts.columns = ['Status', 'Count']
                fig_sms = px.bar(reply_counts, x='Status', y='Count', title="Reply Intent Analysis", color='Status')
                st.plotly_chart(fig_sms, use_container_width=True)
            else:
                st.info("No text replies received yet.")
        else:
            st.info("No SMS/WhatsApp data available yet.")
    with c2:
        if 'last_reply' in df.columns:
            st.write("Message Logs")
            # Show relevant columns if they exist
            cols = ['name', 'phone', 'status']
            if 'last_reply_snippet' in df.columns: cols.append('last_reply_snippet')
            st.dataframe(df[df['last_reply'].notna()][cols], use_container_width=True)

st.markdown("---")

# 5. ACTION CENTER (Table)
st.subheader("📋 Conversion-Ready Leads (Routing Queue)")

# Filter columns to show only what matters
cols_to_show = ['name', 'company', 'phone', 'score', 'category', 'status', 'owner']
# Handle missing columns gracefully
available_cols = [c for c in cols_to_show if c in df.columns]

# Filter for Warm/Hot leads only
if 'score' in df.columns:
    actionable_df = df[df['score'] >= 20].sort_values(by='score', ascending=False)
    st.dataframe(actionable_df[available_cols], use_container_width=True)
else:
    st.dataframe(df[available_cols], use_container_width=True)

# Auto-refresh button
if st.button('🔄 Refresh Data'):
    st.rerun()