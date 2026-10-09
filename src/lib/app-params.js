const isNode = typeof window === 'undefined';

const isClearAccessTokenRequested = () =>
	!isNode && new URLSearchParams(window.location.search).get("clear_access_token") === 'true';

const clearStoredAccessToken = () => {
	if (!isNode) {
		window.localStorage.removeItem('access_token');
		window.localStorage.removeItem('token');
	}
}

const getAppParams = () => {
	if (isClearAccessTokenRequested()) {
		clearStoredAccessToken();
	}
	return {
		appId: 'mindcave-local',
		token: null,
	}
}

export const appParams = {
	...getAppParams()
}
