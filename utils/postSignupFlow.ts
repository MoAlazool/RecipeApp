import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PostSignupFlowState {
  paywallHandled: boolean;
  usernameHandled: boolean;
}

const POST_SIGNUP_FLOW_PREFIX = 'post-signup-flow';

const getPostSignupFlowKey = (userId: string) =>
  `${POST_SIGNUP_FLOW_PREFIX}:${userId}`;

export const markPostSignupFlowPending = async (userId: string) => {
  const initialState: PostSignupFlowState = {
    paywallHandled: false,
    usernameHandled: false,
  };

  await AsyncStorage.setItem(
    getPostSignupFlowKey(userId),
    JSON.stringify(initialState)
  );
};

export const getPostSignupFlowState = async (
  userId: string
): Promise<PostSignupFlowState | null> => {
  const rawState = await AsyncStorage.getItem(getPostSignupFlowKey(userId));
  if (!rawState) return null;

  try {
    const parsed = JSON.parse(rawState);
    const state: PostSignupFlowState = {
      paywallHandled: Boolean(parsed?.paywallHandled),
      usernameHandled: Boolean(parsed?.usernameHandled),
    };
    return state;
  } catch {
    await AsyncStorage.removeItem(getPostSignupFlowKey(userId));
    return null;
  }
};

export const updatePostSignupFlowState = async (
  userId: string,
  updates: Partial<PostSignupFlowState>
): Promise<PostSignupFlowState | null> => {
  const currentState = await getPostSignupFlowState(userId);
  if (!currentState) return null;

  const nextState: PostSignupFlowState = {
    ...currentState,
    ...updates,
  };

  await AsyncStorage.setItem(
    getPostSignupFlowKey(userId),
    JSON.stringify(nextState)
  );

  return nextState;
};

export const clearPostSignupFlowState = async (userId: string) => {
  await AsyncStorage.removeItem(getPostSignupFlowKey(userId));
};
