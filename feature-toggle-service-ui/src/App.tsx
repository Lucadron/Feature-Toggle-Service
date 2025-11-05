import React, { useState, useEffect, useMemo } from 'react';
import axios, { AxiosInstance } from 'axios';
import './index.css';

const API_BASE_URL = 'http://localhost:3000';

// --- Arayüzler (Değişiklik yok) ---
interface FeatureFlag {
    id: string;
    featureId: string;
    name: string;
    env: string;
    enabled: boolean;
    strategy: string;
    strategyValue?: any;
}
interface ApiPagination {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
interface FeaturesResponse {
    data: FeatureFlag[];
    pagination: ApiPagination;
    source?: string;
}
type Environment = 'dev' | 'staging' | 'prod';
type Strategy = 'BOOLEAN' | 'PERCENTAGE' | 'USER';
// --- Arayüzler sonu ---

function App() {
    const [token, setToken] = useState<string>('');
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [selectedEnv, setSelectedEnv] = useState<Environment>('dev');
    const [features, setFeatures] = useState<FeatureFlag[]>([]);
    const [page, setPage] = useState<number>(1);
    const [totalPages, setTotalPages] = useState<number>(1);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const [showAddForm, setShowAddForm] = useState<boolean>(false);
    const [newFlag, setNewFlag] = useState({
        featureId: '',
        env: 'dev' as Environment,
        enabled: false,
        strategy: 'BOOLEAN' as Strategy,
        strategyValue: ''
    });

    // Token değiştiğinde axios instance'ını güncelleyen hook
    const axiosInstance = useMemo(() => {
        return axios.create({
            baseURL: API_BASE_URL,
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
    }, [token]);

    // --- DÜZELTİLMİŞ fetchFeatures ---
    // Bu fonksiyon artık isAuthenticated'i KONTROL EDECEK, ayarlamayacak
    const fetchFeatures = async () => {
        if (!isAuthenticated) return; // Zaten giriş yapılmamışsa çağırma

        setLoading(true);
        setError('');
        try {
            const response = await axiosInstance.get<FeaturesResponse>(
                `/features?env=${selectedEnv}&page=${page}&limit=20`
            );
            setFeatures(response.data.data || []);
            setTotalPages(response.data.pagination.totalPages || 1);
        } catch (err: any) {
            const errorMsg = err.response?.data?.error || 'Failed to fetch features';
            setError(errorMsg);
            if (err.response?.status === 401) {
                setIsAuthenticated(false); // Hata 401 ise (token yanlış) anında logout yap
                setError('Token is invalid or expired. Please re-authenticate.');
            }
        } finally {
            setLoading(false);
        }
    };

    // Sadece ortam veya sayfa değiştiğinde (ve giriş yapılmışsa) veriyi yeniden çek
    useEffect(() => {
        if (isAuthenticated) {
            fetchFeatures();
        }
    }, [selectedEnv, page]); // Token değişikliği artık burada fetch tetiklemiyor

    // --- DÜZELTİLMİŞ handleTokenSubmit ---
    // Artık 'Giriş Yap' butonu GERÇEKTEN giriş yapmayı deneyecek
    const handleTokenSubmit = async () => {
        if (!token.trim()) {
            setError('Please enter a valid token');
            return;
        }

        setLoading(true);
        setError('');

        // Token'ı kullanarak geçici bir axios instance'ı oluştur
        const tempAxios = axios.create({
            baseURL: API_BASE_URL,
            headers: { Authorization: `Bearer ${token}` }
        });

        try {
            // Giriş yapmak için /features endpoint'ine bir test isteği at
            // (Daha iyisi, /health gibi token gerektiren basit bir endpoint olurdu, ama /features da iş görür)
            await tempAxios.get<FeaturesResponse>(`/features?env=${selectedEnv}&page=1&limit=1`);

            // ---- BAŞARILI ----
            // İstek başarılı olduysa (401 almadıysak) token geçerlidir.
            setIsAuthenticated(true);
            // Geri kalan state'i (features, totalPages) normal useEffect tetikleyecek
        } catch (err: any) {
            // ---- BAŞARISIZ ----
            const errorMsg = err.response?.data?.error || 'Failed to fetch features';
            setError(errorMsg);
            if (err.response?.status === 401) {
                setError('Token is invalid or expired. Please re-authenticate.');
            }
            setIsAuthenticated(false);
        } finally {
            setLoading(false);
        }
    };

    // --- Kalan fonksiyonlar (toggle, delete, add) ---
    // Bu fonksiyonlar artık 'axiosInstance'ı güvenle kullanabilir
    // çünkü 'isAuthenticated' true ise token'ın geçerli olduğunu biliyoruz.
    const toggleFeature = async (flag: FeatureFlag) => {
        setError('');
        try {
            await axiosInstance.post('/features', {
                featureId: flag.featureId,
                env: flag.env,
                enabled: !flag.enabled,
                strategy: flag.strategy,
                strategyValue: flag.strategyValue
            });
            await fetchFeatures(); // Listeyi yenile
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to toggle feature');
        }
    };

    const deleteFeature = async (flagId: string) => {
        setError('');
        try {
            await axiosInstance.delete(`/features/${flagId}`);
            await fetchFeatures(); // Listeyi yenile
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to delete feature');
        }
    };

    const addFeature = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            const payload: any = {
                featureId: newFlag.featureId,
                env: newFlag.env,
                enabled: newFlag.enabled,
                strategy: newFlag.strategy
            };
            if (newFlag.strategyValue.trim()) {
                try {
                    payload.strategyValue = JSON.parse(newFlag.strategyValue);
                } catch {
                    setError('Invalid JSON in strategy value');
                    return;
                }
            }
            await axiosInstance.post('/features', payload);
            setNewFlag({
                featureId: '',
                env: selectedEnv,
                enabled: false,
                strategy: 'BOOLEAN',
                strategyValue: ''
            });
            setShowAddForm(false);
            await fetchFeatures(); // Listeyi yenile
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to add feature');
        }
    };

    // --- JSX (Giriş Formu) ---
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
                    <h1 className="text-2xl font-bold mb-6">Feature Flag Admin</h1>
                    {/* Hata mesajını üste taşıdık */}
                    {error && <div className="text-red-600 text-sm mb-4">{error}</div>}
                    {loading && <div className="text-blue-600 text-sm mb-4">Authenticating...</div>}

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">JWT Token</label>
                            <input
                                type="text"
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Paste your JWT token"
                                disabled={loading}
                            />
                        </div>
                        <button
                            onClick={handleTokenSubmit}
                            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
                            disabled={loading}
                        >
                            {loading ? 'Checking...' : 'Authenticate'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // --- JSX (Ana Uygulama) ---
    // (Bu kısım aynı, değişiklik yok)
    return (
        <div className="min-h-screen bg-gray-100 p-4">
            <div className="max-w-6xl mx-auto">
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h1 className="text-2xl font-bold mb-4">Feature Flag Admin</h1>

                    <div className="flex gap-4 items-center mb-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Environment</label>
                            <select
                                value={selectedEnv}
                                onChange={(e) => {
                                    setSelectedEnv(e.target.value as Environment);
                                    setPage(1);
                                }}
                                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="dev">Development</option>
                                <option value="staging">Staging</option>
                                <option value="prod">Production</option>
                            </select>
                        </div>

                        <button
                            onClick={() => setShowAddForm(!showAddForm)}
                            className="mt-6 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700"
                        >
                            {showAddForm ? 'Cancel' : 'Add New Flag'}
                        </button>

                        <button
                            onClick={() => {
                                setIsAuthenticated(false);
                                setToken('');
                                setFeatures([]);
                            }}
                            className="mt-6 ml-auto bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700"
                        >
                            Logout
                        </button>
                    </div>

                    {error && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                            {error}
                        </div>
                    )}

                    {showAddForm && (
                        <form onSubmit={addFeature} className="bg-gray-50 p-4 rounded-md mb-6">
                            <h3 className="font-semibold mb-4">Add New Feature Flag</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Feature ID</label>
                                    <input
                                        type="text"
                                        required
                                        value={newFlag.featureId}
                                        onChange={(e) => setNewFlag({ ...newFlag, featureId: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                        placeholder="E.g., cmh95kkqg00059d1cx049uud5"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Environment</label>
                                    <select
                                        value={newFlag.env}
                                        onChange={(e) => setNewFlag({ ...newFlag, env: e.target.value as Environment })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                    >
                                        <option value="dev">Development</option>
                                        <option value="staging">Staging</option>
                                        <option value="prod">Production</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Strategy</label>
                                    <select
                                        value={newFlag.strategy}
                                        onChange={(e) => setNewFlag({ ...newFlag, strategy: e.target.value as Strategy })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                    >
                                        <option value="BOOLEAN">BOOLEAN</option>
                                        <option value="PERCENTAGE">PERCENTAGE</option>
                                        <option value="USER">USER</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Strategy Value (JSON)</label>
                                    <input
                                        type="text"
                                        value={newFlag.strategyValue}
                                        onChange={(e) => setNewFlag({ ...newFlag, strategyValue: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                        placeholder='{"percentage":50}'
                                    />
                                </div>
                                <div className="flex items-center">
                                    <label className="flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={newFlag.enabled}
                                            onChange={(e) => setNewFlag({ ...newFlag, enabled: e.target.checked })}
                                            className="mr-2"
                                        />
                                        <span className="text-sm font-medium">Enabled</span>
                                    </label>
                                </div>
                            </div>
                            <button
                                type="submit"
                                className="mt-4 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
                            >
                                Create Flag
                            </button>
                        </form>
                    )}
                </div>

                <div className="bg-white rounded-lg shadow-md p-6">
                    {loading ? (
                        <div className="text-center py-8">Loading...</div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left py-3 px-4">Feature Name</th>
                                            <th className="text-left py-3 px-4">Environment</th>
                                            <th className="text-left py-3 px-4">Enabled</th>
                                            <th className="text-left py-3 px-4">Strategy</th>
                                            <th className="text-left py-3 px-4">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {features.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="text-center py-8 text-gray-500">
                                                    No features found
                                                </td>
                                            </tr>
                                        ) : (
                                            features.map((flag) => (
                                                <tr key={flag.id} className="border-b hover:bg-gray-50">
                                                    <td className="py-3 px-4">{flag.name}</td>
                                                    <td className="py-3 px-4">{flag.env}</td>
                                                    <td className="py-3 px-4">
                                                        <label className="flex items-center cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={flag.enabled}
                                                                onChange={() => toggleFeature(flag)}
                                                                className="mr-2"
                                                            />
                                                            <span className={flag.enabled ? 'text-green-600' : 'text-gray-400'}>
                                                                {flag.enabled ? 'Yes' : 'No'}
                                                            </span>
                                                        </label>
                                                    </td>
                                                    <td className="py-3 px-4">{flag.strategy}</td>
                                                    <td className="py-3 px-4">
                                                        <button
                                                            onClick={() => deleteFeature(flag.id)}
                                                            className="bg-red-600 text-white py-1 px-3 rounded hover:bg-red-700 text-sm"
                                                        >
                                                            Delete
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {totalPages > 1 && (
                                <div className="flex justify-center gap-4 mt-6">
                                    <button
                                        onClick={() => setPage(page - 1)}
                                        disabled={page === 1}
                                        className="px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Previous
                                    </button>
                                    <span className="flex items-center">
                                        Page {page} of {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setPage(page + 1)}
                                        disabled={page === totalPages}
                                        className="px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default App;