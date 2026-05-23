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
    });
  },

  logout: () => {
    clearAuthToken();
    localStorage.removeItem('givegive_user');
    set({
      isLoggedIn: false,
      userRole: null,
      userId: '',
      nickname: '1111',
    });
  },
}));

export default useAuthStore;
