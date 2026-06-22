import { create } from 'zustand';
import { clearAuthToken, saveAuthToken } from '../api/client';

const savedUser = (() => {
  try {
    return JSON.parse(localStorage.getItem('givegive_user') || 'null');
  } catch {
    return null;
  }
})();

const useAuthStore = create((set) => ({
  isLoggedIn: Boolean(localStorage.getItem('givegive_access_token')),
  userRole: savedUser?.role || null,
  userId: savedUser?.email || '',
  nickname: savedUser?.nickname || '1111',
  user: savedUser,

  login: (role, id, token, member = {}) => {
    if (token) {
      saveAuthToken(token);
    }

    const user = {
      role,
      email: id,
      nickname: member.nickname || id || '1111',
      ...member,
    };

    localStorage.setItem('givegive_user', JSON.stringify(user));
    set({
      isLoggedIn: true,
      userRole: role,
      userId: id,
      nickname: user.nickname,
      user,
    });
  },

  setUser: (member = {}) => set((state) => {
    const user = {
      ...(state.user || {}),
      ...member,
      nickname: member.nickname || member.name || member.email || state.nickname || '회원',
    };

    localStorage.setItem('givegive_user', JSON.stringify(user));
    return {
      user,
      userRole: user.role || user.role_id || user.roleId || null,
      userId: user.email || user.member_id || user.memberId || '',
      nickname: user.nickname,
      isLoggedIn: true,
    };
  }),

  logout: () => {
    clearAuthToken();
    localStorage.removeItem('givegive_user');
    set({
      isLoggedIn: false,
      userRole: null,
      userId: '',
      nickname: '1111',
      user: null,
    });
  },
}));

export default useAuthStore;
